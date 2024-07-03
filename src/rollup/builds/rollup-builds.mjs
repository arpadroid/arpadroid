import { bundleStats } from 'rollup-plugin-bundle-stats';
import { dts } from 'rollup-plugin-dts';
import { hideBin } from 'yargs/helpers';
import buildStyles from '../plugins/buildStyles.mjs';
import chalk from 'chalk';
import fs from 'fs';
import multiEntry from '@rollup/plugin-multi-entry';
import nodeResolve from '@rollup/plugin-node-resolve';
import path from 'path';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import Project from '../../projectBuilder/project.mjs';
import rollupWatch from 'rollup-plugin-watch';
import terser from '@rollup/plugin-terser';
import watchDeps from '../plugins/watchDeps.mjs';
import yargs from 'yargs';

const argv = yargs(hideBin(process.argv)).argv;
const cwd = process.cwd();
const DEPS = process.env['deps'] ?? argv.deps;
const PROD = Boolean(process.env['production']);
const SLIM = argv?.slim === 'true';
const WATCH = Boolean(!PROD && argv.watch);

/**
 * Rollup builds.
 * @type {Record<string, (project: Project, config: Record<string, unknown>) => import('rollup').RollupOptions>}
 */
const rollupBuilds = {
    uiComponent(project, config = {}) {
        return {
            input: getInput(config),
            plugins: getPlugins(project, config),
            output: getOutput(project, config)
        };
    }
};

/**
 * Returns whether the build should be slim.
 * @returns {boolean}
 */
export function isSlim() {
    return (process.env['arpadroid_slim'] && process.env['arpadroid_slim'] === 'true') ?? SLIM;
}

/**
 * Returns whether the build should watch for changes.
 * @returns {boolean}
 */
export function shouldWatch() {
    return process.env['arpadroid_watch'] ?? WATCH;
}

/**
 * Returns the build configuration for the specified project and build.
 * @param {string} projectName
 * @param {string} buildName
 * @param {Record<string, unknown>} config
 * @param {Record<string, unknown>} projectConfig
 * @returns {Record<string, unknown>}
 */
export function getBuild(projectName, buildName, config = {}, projectConfig = {}) {
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
    const project = new Project(projectName, projectConfig);
    const appBuild = rollupBuilds[buildName](project, buildConfig);
    const typesBuild = getTypesBuild();
    const build = [appBuild, typesBuild].filter(Boolean);
    return { build, plugins: appBuild.plugins, appBuild, typesBuild, project, ...config };
}

/**
 * Pre-processes the dependencies.
 * @param {string | string[]} deps
 */
export function preProcessDependencies(deps = DEPS) {
    if (typeof deps === 'string') {
        deps = deps.split(',').map(dep => dep.trim());
    }
    return Array.isArray(deps) ? deps : [];
}

/**
 * Returns the configuration for the typescript types build.
 * @returns {import('rollup').InputOptions}
 */
export function getTypesBuild() {
    const typesPath = path.join('src', 'types.d.ts');
    if (!fs.existsSync(typesPath)) {
        return null;
    }
    return {
        input: './src/types.d.ts',
        output: { file: path.join('dist', 'types.d.ts'), format: 'es' },
        plugins: [dts()]
    };
}
/**
 * Returns the rollup input configuration.
 * @param {Record<string, unknown>} config
 * @returns {string | string[]}
 */
export function getInput(config = {}) {
    const { deps, slim } = config;
    const entry = 'src/index.js';
    if (slim || !deps?.length) {
        return entry;
    }
    const rv = [entry];
    deps.forEach(dep => {
        const depPath = path.join(cwd, 'node_modules', '@arpadroid', dep, 'dist', `arpadroid-${dep}.js`);
        if (fs.existsSync(depPath)) {
            rv.push(depPath);
        } else {
            cli.error(`Dependency ${dep} not found`);
        }
    });
    return rv;
}

/**
 * Returns the rollup plugins configuration.
 * @param {Project} project
 * @param {Record<string, unknown>} config
 * @returns {import('rollup').Plugin[]}
 */
export function getPlugins(project, config) {
    const { slim } = config;
    return [
        terser({ keep_classnames: true }),
        ...(slim ? getSlimPlugins(project, config) : getFatPlugins(project, config)),
        buildStyles(project, config)
    ].filter(Boolean);
}

/**
 * Returns the slim build rollup plugins configuration.
 * @returns {import('rollup').Plugin[]}
 */
export function getSlimPlugins() {
    return [peerDepsExternal()];
}

/**
 * Returns the fat build rollup plugins configuration.
 * @param {Project} project
 * @param {Record<string, unknown>} config
 * @returns {import('rollup').Plugin[]}
 */
export function getFatPlugins(project, config) {
    const { deps, watch = WATCH } = config;
    return [
        nodeResolve({ browser: true, preferBuiltins: false }),
        watch && fs.existsSync(path.join(cwd, 'src', 'themes')) && rollupWatch({ dir: 'src/themes' }),
        /** @todo - Polish the watch strategy as some dependencies do not trigger Hot Module Replacement or even automatic browser page reload when changed. */
        watch && watchDeps(project, config),
        deps.length && multiEntry(),
        bundleStats()
    ];
}

/**
 * Returns the rollup output configuration.
 * @param {Project} project
 * @param {Record<string, unknown>} config
 * @returns {import('rollup').OutputOptions}
 */
export function getOutput(project) {
    return {
        file: `dist/arpadroid-${project.name}.js`,
        format: 'es'
    };
}

export default rollupBuilds;
