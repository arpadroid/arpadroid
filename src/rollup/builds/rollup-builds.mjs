import fs from 'fs';
import multiEntry from '@rollup/plugin-multi-entry';
import nodeResolve from '@rollup/plugin-node-resolve';
import alias from '@rollup/plugin-alias';
import rollupWatch from 'rollup-plugin-watch';
import { dts } from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import buildStyles from '../plugins/buildStyles/buildStyles.mjs';
import { bundleStats } from 'rollup-plugin-bundle-stats';
import Project from '../../projectBuilder/project.mjs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import chalk from 'chalk';

const argv = yargs(hideBin(process.argv)).argv;
const SLIM = Boolean(process.env.slim ?? argv.slim);
const PROD = Boolean(process.env['production']);
const DEPS = process.env['deps'] ?? argv.deps;
const WATCH = !PROD && Boolean(process.env['watch']);
const cwd = process.cwd();

export function getBuild(projectName, buildName, config = {}) {
    const defaultConfig = {
        slim: isSlim(),
        production: PROD,
        watch: shouldWatch()
    };
    const buildConfig = { ...defaultConfig, ...config };
    if (!buildConfig.slim && !buildConfig.deps?.length) {
        buildConfig.deps = preProcessDependencies(DEPS);
    }
    if (typeof rollupBuilds[buildName] !== 'function') {
        chalk.red(`Invalid build name: ${buildName}`);
        return;
    }
    const appBuild = rollupBuilds[buildName](projectName, buildConfig);
    const typesBuild = getTypesBuild();
    const build = [appBuild, typesBuild].filter(Boolean);
    return { build, plugins: appBuild.plugins, appBuild, typesBuild, ...config };
}

const rollupBuilds = {
    uiComponent(projectName, config = {}) {
        return {
            input: getInput(config),
            plugins: getPlugins(projectName, config),
            output: getOutput(projectName, config)
        };
    }
};

export function getTypesBuild() {
    if (!fs.existsSync('src/types.d.ts')) {
        return null;
    }
    return {
        input: './src/types.d.ts',
        output: { file: 'dist/types.d.ts', format: 'es' },
        plugins: [dts()]
    };
}

export function preProcessDependencies(deps = DEPS) {
    if (typeof deps === 'string') {
        deps = deps.split(',').map(dep => dep.trim());
    }
    return Array.isArray(deps) ? deps : [];
}
export function isSlim() {
    return (process.env['arpadroid_slim'] && process.env['arpadroid_slim'] === 'true') ?? SLIM;
}

export function shouldWatch() {
    return process.env['arpadroid_watch'] ?? WATCH;
}

export function getInput(config = {}) {
    const { deps, slim } = config;
    const entry = 'src/index.js';
    if (slim || !deps?.length) {
        return entry;
    }
    // if (!deps?.length) {
    //     return entry;
    // }
    const rv = [entry];
    deps.forEach(dep => {
        if (fs.existsSync(cwd + `/node_modules/@arpadroid/${dep}`)) {
            rv.push(`node_modules/@arpadroid/${dep}/dist/arpadroid-${dep}.js`);
        } else {
            cli.error(`Dependency ${dep} not found`);
        }
    });
    return rv;
}

export function watchDependencies(projectName) {
    const project = new Project(projectName);
    return project
        .getArpadroidPackages()
        .map(pkg => rollupWatch({ dir: `node_modules/@arpadroid/${pkg}/dist` }));
}

export function getSlimPlugins() {
    return [peerDepsExternal()];
}

export function getFatPlugins(projectName, { slim, deps, watch, aliases = [] }) {
    const watchDeps = watch && !slim ? watchDependencies(projectName) : [];
    return [
        nodeResolve({ browser: true, preferBuiltins: false }),
        watch && fs.existsSync(cwd + '/src/themes') && rollupWatch({ dir: 'src/themes' }),
        ...watchDeps,
        deps.length && multiEntry(),
        bundleStats()
    ];
}

export function getPlugins(projectName, config) {
    const { slim, aliases } = config;
    return [
        terser({ keep_classnames: true }),
        // alias({ entries: [{ find: `@arpadroid/${projectName}`, replacement: cwd + '/src/index.js' }] }),
        ...(slim ? getSlimPlugins(projectName, config) : getFatPlugins(projectName, config)),
        buildStyles(projectName, config)
    ].filter(Boolean);
}

export function getOutput(projectName) {
    return {
        file: `dist/arpadroid-${projectName}.js`,
        format: 'es'
    };
}

export default rollupBuilds;
