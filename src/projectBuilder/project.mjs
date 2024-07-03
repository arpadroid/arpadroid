/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable security/detect-non-literal-require */
import { rollup, watch as rollupWatch } from 'rollup';
import { readFileSync, existsSync, writeFileSync, cpSync, rmSync, readdirSync, mkdirSync } from 'fs';
import alias from '@rollup/plugin-alias';
import fs from 'fs';
import path from 'path';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import StylesheetBundler from '@arpadroid/stylesheet-bundler';
import { spawn } from 'child_process';
import chalk from 'chalk';

const cwd = process.cwd();
const argv = yargs(hideBin(process.argv)).argv;
const SLIM = Boolean(argv.slim ?? process.env.slim);
const MINIFY = Boolean(argv.minify ?? process.env.minify);
const WATCH = Boolean(argv.watch ?? process.env.watch);
const STORYBOOK_PORT = argv['storybook'] ?? process.env['storybook'];
const STYLE_PATTERNS = argv['style-patterns'];
const DEPENDENCY_SORT = ['tools', 'i18n', 'application', 'ui', 'lists', 'navigation', 'messages', 'form'];
const STYLE_SORT = ['ui', 'lists', 'navigation', 'messages', 'form'];
class Project {
    // #region INITIALIZATION
    constructor(name, config = {}) {
        this.setConfig(config);
        this.name = name;
        this.path = this.getPath();
        this.pkg = this.getPackageJson();
        this.scripts = this.pkg?.scripts ?? {};
    }

    getPackageJson() {
        return (
            existsSync(`${this.path}/package.json`) && JSON.parse(readFileSync(`${this.path}/package.json`))
        );
    }

    setConfig(config) {
        this.config = Object.assign(this.getDefaultConfig(), config);
    }

    getDefaultConfig() {
        return {
            basePath: cwd
        };
    }

    async getFileConfig() {
        const configFile = `${this.path}/arpadroid.config.js`;
        return existsSync(configFile) ? (await import(configFile)).default : {};
    }

    validate() {
        if (!existsSync(this.path)) {
            console.error(`Project ${this.name} does not exist`);
            return false;
        }
        return true;
    }

    getPath() {
        if (this.config?.path) {
            return this.config.path;
        }
        const basename = path.basename(cwd);
        if (basename !== this.name) {
            return `${this.config.basePath}/node_modules/@arpadroid/${this.name}`;
        }
        return cwd;
    }

    // #endregion

    // #region ACCESSORS

    hasStyles() {
        return this.getThemes().length > 0;
    }

    getThemesPath() {
        return `${this.path}/src/themes`;
    }

    getThemes() {
        const path = this.getThemesPath();
        return fs.existsSync(path) ? readdirSync(path) : [];
    }

    getArpadroidDependencies(sort = DEPENDENCY_SORT) {
        const packages = Object.entries(this.pkg?.peerDependencies ?? {})
            .map(([name]) => name.startsWith('@arpadroid/') && name.replace('@arpadroid/', ''))
            .filter(Boolean);
        if (sort?.length) {
            const rv = [];
            sort.forEach(pkg => {
                if (packages.includes(pkg)) {
                    rv.push(pkg);
                    packages.splice(packages.indexOf(pkg), 1);
                }
            });
            return rv.concat(packages);
        }
        return packages;
    }

    async getBuildConfig(_config = {}) {
        this.fileConfig = (await this.getFileConfig()) || {};
        const config = {
            ...this.fileConfig,
            ..._config
        };
        return config;
    }

    // #endregion

    // #region BUILD
    async build(_config = {}) {
        const config = await this.getBuildConfig(_config);
        const slim = config.slim ?? SLIM;
        console.log(
            chalk.bold.bgBlack.cyanBright(`Building ${chalk.magenta(this.name)} project with config:`),
            config
        );
        await this.cleanBuild();
        const rollupConfig = (await import(`${this.path}/rollup.config.mjs`)).default;
        !slim && (await this.buildDependencies(config));
        await this.bundleStyles(config);
        await this.rollup(rollupConfig, config);
        this.runStorybook(config);
        this.watch(rollupConfig, config);
        console.log(chalk.green.bold(`Finished building ${chalk.magenta(this.name)} project.`));
        return true;
    }

    async runStorybook({ slim = SLIM }) {
        if (!STORYBOOK_PORT || slim) {
            return;
        }
        console.log(chalk.cyan(`Running ${chalk.magenta(this.name)} storybook...`));
        const cmd = await this.getStorybookCmd();
        spawn(cmd, { shell: true, stdio: 'inherit', cwd: this.path });
        console.log(chalk.green(`Finished running ${chalk.magenta(this.name)} storybook.`));
    }

    async getStorybookCmd() {
        const projectPath = `${this.path}/.storybook`;
        const arpadroidPath = `${this.path}/node_modules/@arpadroid/arpadroid/.storybook`;
        const configPath = existsSync(projectPath) ? projectPath : arpadroidPath;
        return `node ./node_modules/@arpadroid/arpadroid/node_modules/storybook dev -p ${STORYBOOK_PORT} -c "${configPath}"`;
    }

    async cleanBuild() {
        console.log(chalk.cyan(`Cleaning ${chalk.magenta(this.name)} build...`));
        if (existsSync(`${this.path}/dist`)) {
            rmSync(`${this.path}/dist`, { recursive: true, force: true });
        }
        mkdirSync(`${this.path}/dist`, { recursive: true });
        console.log(chalk.green(`Finished cleaning ${chalk.magenta(this.name)} build.`));
        return true;
    }

    async buildDependencies(config = {}) {
        console.log(chalk.cyan(`Building ${chalk.magenta(this.name)} dependencies...`), config);
        const projects = this.createDependencyInstances();
        process.env.arpadroid_slim = true;
        const rv = await Promise.all(
            projects.map(async project => {
                const config = {
                    slim: true,
                    isDependency: true
                };
                return await project.build(config);
            })
        ).catch(err => {
            console.error(chalk.red(`Failed to build ${chalk.magenta(this.name)} dependencies`), err);
            return Promise.reject(err);
        });
        process.env.arpadroid_slim = '';
        return rv;
    }

    async bundleStyles(config = {}) {
        console.log(chalk.blue(`Bundling ${chalk.magenta(this.name)} styles...`));
        const { path = this.path } = config;
        const slim = config.slim ?? SLIM;
        const minify = config.minify ?? MINIFY;
        let { style_patterns = STYLE_PATTERNS ?? [] } = config;
        if (typeof style_patterns === 'string') {
            style_patterns = style_patterns.split(',').map(pattern => pattern.trim());
        }
        style_patterns = style_patterns.map(pattern => `${this.path}/src/${pattern}`);
        const bundler = new StylesheetBundler.ThemesBundler({
            exportPath: path + '/dist/themes',
            minify,
            patterns: [path + '/src/components/**/*', ...style_patterns],
            slim,
            themes: this.getThemes().map(theme => ({ path: `${this.path}/src/themes/${theme}` }))
        });
        await bundler.initialize();
        console.log(chalk.green(`Finished bundling ${chalk.magenta(this.name)} styles.`));
        return bundler;
    }

    createDependencyInstances() {
        return this.getArpadroidDependencies().map(
            packageName => new Project(packageName, { path: `${cwd}/node_modules/@arpadroid/${packageName}` })
        );
    }

    async rollup(rollupConfig, config) {
        const { aliases } = config;
        console.log(chalk.cyan(`Rolling up ${chalk.magenta(this.name)}...`));
        const appBuild = rollupConfig[0];
        const plugins = appBuild.plugins;
        if (aliases?.length) {
            plugins.push(alias({ entries: aliases }));
        }
        await Promise.all(
            rollupConfig.map(async conf => {
                return new Promise(async resolve => {
                    conf.input = this.preProcessInputs(conf.input);
                    conf.output.file = `${this.path}/${conf.output.file}`;
                    const bundle = await rollup(conf);
                    await bundle.write(conf.output);
                    resolve(true);
                });
            })
        );
        console.log(chalk.cyan(`Finished rolling up ${chalk.magenta(this.name)}.`));
        return true;
    }

    preProcessInputs(inputs) {
        if (Array.isArray(inputs)) {
            return inputs.map(this.preProcessInput.bind(this));
        }
        return this.preProcessInput(inputs);
    }

    preProcessInput(input) {
        if (typeof input === 'string' && input.startsWith('./')) {
            input = input.slice(2);
        }
        return `${this.path}/${input}`;
    }

    watch(rollupConfig, { watch = WATCH, slim }) {
        if (!watch) { // || slim
            return;
        }
        this.watcher = rollupWatch(rollupConfig);
        this.watcher.on('event', event => {
            if (event.code === 'ERROR') {
                console.error(
                    chalk.red(`Error occurred while watching ${chalk.magenta(this.name)}`),
                    event.error
                );
            } else if (event.code === 'END') {
                console.log(chalk.green(`Stopped watching ${chalk.magenta(this.name)}`));
            } else {
                console.log(chalk.blue(`Got watch event ${chalk.magenta(this.name)}...`), event);
            }
        });
        this.watcher.on('event', ({ result }) => result?.close());
    }
    // #endregion

    // #region BUILD STYLES

    buildStyles(config = {}) {
        const slim = config.slim ?? SLIM;
        if (slim) return;
        const minifiedDeps = this.getStyleBuildFiles() ?? [];
        Object.entries(minifiedDeps).forEach(([theme, files]) => this.buildTheme(theme, files));
        if (this.getArpadroidDependencies().includes('ui')) {
            this.copyUIStyleAssets();
        }
    }

    getStyleBuildFiles() {
        if (!this.hasStyles()) {
            return false;
        }
        const minifiedDeps = {};
        this.getStylePackages().forEach(dep => {
            const project = new Project(dep);
            if (!project.hasStyles()) {
                return false;
            }
            const themes = project.getThemes();
            themes.forEach(theme => {
                !minifiedDeps[theme] && (minifiedDeps[theme] = []);
                minifiedDeps[theme].push(`${project.path}/dist/themes/${theme}/${theme}.min.css`);
            });
        });
        return minifiedDeps;
    }

    getStylePackages() {
        return [...this.getArpadroidDependencies(STYLE_SORT), this.name];
    }

    buildTheme(theme, files) {
        const themePath = `${this.path}/dist/themes/${theme}`;
        let css = '';
        let bundledCss = '';
        files.forEach(file => {
            if (existsSync(file)) {
                css += readFileSync(file, 'utf8');
                const bundledFile = file.replace('.min.css', '.bundled.css');
                if (existsSync(bundledFile)) {
                    bundledCss += readFileSync(bundledFile, 'utf8');
                }
            } else {
                console.log(chalk.red(`Could not bundle file, ${chalk.magentaBright(file)} does not exist`));
            }
        });
        if (css) {
            writeFileSync(`${themePath}/${theme}.final.css`, css);
        }
        if (bundledCss) {
            writeFileSync(`${themePath}/${theme}.bundled.final.css`, bundledCss);
        }
    }

    copyUIStyleAssets() {
        const uiPath = `${this.path}/node_modules/@arpadroid/ui`;
        cpSync(`${uiPath}/src/themes/default/fonts`, `${this.path}/dist/themes/default/fonts`, {
            recursive: true
        });
        cpSync(`${uiPath}/node_modules/material-symbols`, `${this.path}/dist/material-symbols`, {
            recursive: true
        });
    }

    // #endregion
}

export default Project;
