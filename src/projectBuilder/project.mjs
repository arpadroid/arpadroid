/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable security/detect-non-literal-fs-filename */
import { rollup, watch as rollupWatch } from 'rollup';
import { mergeObjects } from '@arpadroid/tools/src/objectTool.js';
import { readFileSync, existsSync, writeFileSync, cpSync, rmSync, readdirSync, mkdirSync } from 'fs';
import alias from '@rollup/plugin-alias';
import fs from 'fs';
import path from 'path';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import StylesheetBundler from '@arpadroid/stylesheet-bundler';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { log, logStyle } from '../utils/terminalLogger.mjs';
import ProjectTest from './projectTest.mjs';

const cwd = process.cwd();
const argv = yargs(hideBin(process.argv)).argv;
const SLIM = Boolean(argv.slim ?? process.env.slim);
const MINIFY = Boolean(argv.minify ?? process.env.minify);
const WATCH = Boolean(argv.watch ?? process.env.watch);
const STORYBOOK_PORT = argv.storybook ?? process.env.storybook;
const STYLE_PATTERNS = argv['style-patterns'];
const DEPENDENCY_SORT = ['tools', 'i18n', 'application', 'ui', 'lists', 'navigation', 'messages', 'forms'];
const STYLE_SORT = ['ui', 'lists', 'navigation', 'messages', 'form'];
const VERBOSE = Boolean(argv.verbose ?? process.env.verbose);

class Project {
    // #region INITIALIZATION
    constructor(name, config = {}) {
        this.setConfig(config);
        this.name = name;
        this.i18nFiles = [];
        this.path = this.getPath();
        this.pkg = this.getPackageJson();
        this.scripts = this.pkg?.scripts ?? {};
    }

    static _getFileConfig() {
        const projectConfigPath = cwd + '/arpadroid.config.js';
        if (existsSync(projectConfigPath)) {
            return require(projectConfigPath).default;
        }
        return {};
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
            basePath: cwd,
            logArpadroid: true
        };
    }

    async getFileConfig() {
        const configFile = `${this.path}/arpadroid.config.js`;
        return existsSync(configFile) ? (await import(configFile)).default : {};
    }

    validate() {
        if (!existsSync(this.path)) {
            log.error(`Project ${this.name} does not exist`);
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

    getScripts() {
        return this.pkg?.scripts;
    }

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

    getArpadroidPath() {
        if (this.name === 'arpadroid') {
            return this.project.path;
        }
        return `${this.path}/node_modules/@arpadroid/arpadroid`;
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
        return mergeObjects(
            {
                logHeading: true,
                ...this.fileConfig
            },
            _config
        );
    }

    test() {
        this.projectTest = new ProjectTest(this);
        return this.projectTest.test();
    }

    // #endregion

    // #region INSTALL
    async install() {
        log.task(this.name, 'Installing project.');
        const cmd = `cd ${this.path} && npm install`;
        // wait until command has completed before returning.
        return new Promise((resolve, reject) => {
            const child = spawn(cmd, { shell: true, stdio: 'inherit' });
            child.on('close', code => {
                code === 0 ? resolve(true) : reject(new Error(`Failed to install ${this.name}`));
            });
        });
    }

    // #endregion

    // #region BUILD
    async build(_config = {}) {
        const config = await this.getBuildConfig(_config);
        const slim = config.slim ?? SLIM;
        this.logBuild(config);
        await this.cleanBuild(config);
        !slim && (await this.buildDependencies(config));
        await this.bundleStyles(config);
        await this.bundleI18n(config);
        process.env.ARPADROID_BUILD_CONFIG = JSON.stringify(config);
        const rollupConfig = (await import(`${this.path}/rollup.config.mjs`)).default;
        await this.rollup(rollupConfig, config);
        this.runStorybook(config);
        this.watch(rollupConfig, config);
        !slim && log.task(this.name, logStyle.success('Build complete, have a nice day ;)'));
        return true;
    }

    async bundleI18n(config) {
        const slim = config.slim ?? SLIM;
        if (slim) return true;
        const script = `${cwd}/node_modules/@arpadroid/i18n/scripts/compile.mjs`;
        const scriptExists = existsSync(script);
        if (scriptExists) {
            const compiler = await import(script);
            this.i18nFiles = await compiler.compileI18n(this);
        }
        return true;
    }

    logBuild(config) {
        const pkgName = '@arpadroid/' + this.name;
        if (!config?.slim) {
            config.logHeading && log.arpadroid();
            console.log(logStyle.heading(`Building project: ${logStyle.pkg(pkgName)} ...`));
        } else {
            log.task(config?.parent ?? this.name, `Building ${logStyle.dep(pkgName)}.`);
        }
    }

    async cleanBuild({ slim }) {
        !slim && log.task(this.name, 'Cleaning up.');
        if (existsSync(`${this.path}/dist`)) {
            rmSync(`${this.path}/dist`, { recursive: true, force: true });
        }
        mkdirSync(`${this.path}/dist`, { recursive: true });
        return true;
    }

    async runStorybook({ slim = SLIM }) {
        if (!STORYBOOK_PORT || slim) {
            return;
        }
        const cmd = await this.getStorybookCmd();
        spawn(cmd, { shell: true, stdio: 'inherit', cwd: this.path });
    }

    async getStorybookCmd() {
        const configPath = this.getStorybookConfigPath();
        return `node ./node_modules/@arpadroid/arpadroid/node_modules/storybook/bin/index.cjs dev -p ${STORYBOOK_PORT} -c "${configPath}"`;
    }

    getStorybookConfigPath() {
        const projectPath = `${this.path}/.storybook`;
        const arpadroidPath = `${this.path}/node_modules/@arpadroid/arpadroid/.storybook`;
        return existsSync(projectPath) ? projectPath : arpadroidPath;
    }

    async buildDependencies() {
        log.task(this.name, 'Building dependencies.');
        const projects = this.createDependencyInstances();
        process.env.arpadroid_slim = true;
        const rv = await Promise.all(
            projects.map(async project => {
                const config = {
                    slim: true,
                    isDependency: true,
                    parent: this.name
                };
                return await project.build(config);
            })
        ).catch(err => {
            log.error(`Failed to build ${logStyle.subject(this.name)} dependencies`, err);
            return Promise.reject(err);
        });

        process.env.arpadroid_slim = '';
        return rv;
    }

    async bundleStyles(config = {}) {
        !config.slim && log.task(this.name, 'Bundling CSS.');
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
        return bundler;
    }

    createDependencyInstances() {
        return this.getArpadroidDependencies().map(
            packageName => new Project(packageName, { path: `${cwd}/node_modules/@arpadroid/${packageName}` })
        );
    }

    async rollup(rollupConfig, config) {
        const { aliases } = config;
        VERBOSE || (!config.slim && log.task(this.name, 'Rolling up.'));
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
        if (!watch) {
            return;
        }
        VERBOSE || (!slim && log.task(this.name, 'watching for file changes'));
        this.watcher = rollupWatch(rollupConfig);
        this.watcher.on('event', event => {
            if (event.code === 'ERROR') {
                log.error(`Error occurred while watching ${this.name}`, event.error);
            } else if (event.code === 'END') {
                // console.log(chalk.green(`Stopped watching ${chalk.magenta(this.name)}`));
            } else {
                VERBOSE && log.task(this.name, 'Got watch event', event);
            }
        });
        this.watcher.on('event', ({ result }) => result?.close());
        !slim && this.runGuardLivereload();
    }

    runGuardLivereload() {
        if (existsSync(`${this.path}/Guardfile`)) {
            log.task(this.name, 'running guard livereload');
            spawn('guard', { shell: true, stdio: 'inherit', cwd: this.path });
        }
    }
    // #endregion

    // #region BUILD STYLES

    buildStyles(config = {}) {
        const slim = config.slim ?? SLIM;
        if (slim) {
            return;
        }
        log.task(this.name, 'Compiling dependency styles.');
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
                log.error(`Could not bundle file, ${chalk.magentaBright(file)} does not exist`);
            }
        });
        if (css) {
            if (!fs.existsSync(themePath)) {
                fs.mkdirSync(themePath, { recursive: true });
            }
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
