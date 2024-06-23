/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable security/detect-non-literal-require */
import { readFileSync, existsSync, writeFileSync, cpSync, rmSync, readdirSync } from 'fs';
import fs from 'fs';
import path from 'path';
import projectBuilder from './projectBuilder.mjs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import StylesheetBundler from '@arpadroid/stylesheet-bundler';
import { execSync } from 'child_process';

const cwd = process.cwd();
const argv = yargs(hideBin(process.argv)).argv;
const SLIM = Boolean(argv.slim);
const MINIFY = Boolean(argv.minify);
const WATCH = Boolean(argv.watch);
const DEPS = argv.deps;
const STYLE_PATTERNS = argv['style-patterns'];

class Project {
    // #region INITIALIZATION
    constructor(name, config = {}) {
        this.builder = new projectBuilder();
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

    validate() {
        if (!existsSync(this.path)) {
            console.error(`Project ${this.name} does not exist`);
            return false;
        }
        return true;
    }

    getPath() {
        const basename = path.basename(cwd);
        if (basename !== this.name) {
            return `${this.config.basePath}/node_modules/@arpadroid/${this.name}`;
        }
        return cwd;
    }

    // #endregion

    // #region ACCESSORS

    hasStyles() {
        return fs.existsSync(this.getThemesPath());
    }

    getThemesPath() {
        return `${this.path}/src/themes`;
    }

    getThemes() {
        return readdirSync(this.getThemesPath());
    }

    getArpadroidPackages(sort = []) {
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

    // #endregion

    // #region BUILD

    getBuildCommand(config = {}) {
        const { watch = false, slim = false } = config;
        let cmd;
        if (this?.scripts['build:watch'] && watch) {
            cmd = 'npm run build:watch';
            if (this?.scripts['build:watch:slim'] && slim) {
                cmd += ':slim';
            }
            return cmd;
        }
        if (this.scripts?.build) {
            cmd = 'npm run build';
            if (this?.scripts['build:slim'] && slim) {
                cmd += ':slim';
            }
        }

        return cmd;
    }

    async buildDependencies(config = {}) {
        await this.builder.buildPackages({
            exceptions: this.name,
            slim: true,
            projects: this.getArpadroidPackages(),
            ...config
        });
    }

    async build() {
        await this.buildDependencies();
        await this.cleanBuild();
        await this.bundleStyles();
        await this.rollup();
    }

    async rollup() {
        let cmd = `cd ${this.path} && ${this.getRollupParams()} rollup -c`;
        if (WATCH) {
            cmd += ' -w';
        }
        console.log('cmd', cmd);
        return execSync(cmd, { stdio: 'inherit' });
    }

    getRollupParams() {
        let params = '';
        if (SLIM) {
            params += 'slim=true ';
        }
        if (DEPS) {
            params += `deps=${DEPS} `;
        }
        return params;
    }

    async cleanBuild() {
        return existsSync(`${this.path}/dist`) ? rmSync(`${this.path}/dist`, { recursive: true }) : true;
    }

    // #endregion

    // #region BUILD STYLES
    async bundleStyles(config = {}) {
        let { patterns = STYLE_PATTERNS ?? [] } = config;
        if (typeof patterns === 'string') {
            patterns = patterns.split(',').map(pattern => pattern.trim());
        }
        const bundler = new StylesheetBundler.ThemesBundler({
            exportPath: cwd + '/dist/themes',
            minify: MINIFY,
            patterns: [cwd + '/src/components/**/*', ...patterns],
            slim: SLIM,
            themes: this.getThemes().map(theme => ({ path: `${this.path}/src/themes/${theme}` }))
        });
        await bundler.initialize();
        return bundler;
    }

    buildStyles() {
        const minifiedDeps = this.getStyleBuildFiles() ?? [];
        Object.entries(minifiedDeps).forEach(([theme, files]) => {
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
                    console.log(`Could not bundle file, ${file} does not exist`);
                }
            });
            if (css) {
                writeFileSync(`${themePath}/${theme}.final.css`, css);
            }
            if (bundledCss) {
                writeFileSync(`${themePath}/${theme}.bundled.final.css`, bundledCss);
            }
        });
    }

    getStylePackages() {
        return [...this.getArpadroidPackages(['ui', 'lists', 'navigation', 'messages', 'form']), this.name];
    }

    getStyleBuildFiles() {
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
            if (dep === 'ui') {
                const fontsPath = `${this.path}/dist/themes/default/fonts`;
                cpSync(`${project.path}/dist/themes/default/fonts`, fontsPath, { recursive: true });
                cpSync(`${project.path}/dist/material-symbols`, `${this.path}/dist/material-symbols`, {
                    recursive: true
                });
            }
        });
        return minifiedDeps;
    }

    // #endregion
}

export default Project;
