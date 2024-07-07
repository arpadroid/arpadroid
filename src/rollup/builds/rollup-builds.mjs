import { bundleStats } from 'rollup-plugin-bundle-stats';
import { dts } from 'rollup-plugin-dts';
import { hideBin } from 'yargs/helpers';
import buildStyles from '../plugins/buildStyles.mjs';
import fs from 'fs';
import multiEntry from '@rollup/plugin-multi-entry';
import nodeResolve from '@rollup/plugin-node-resolve';
import path from 'path';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import Project from '../../projectBuilder/project.mjs';
import rollupWatch from 'rollup-plugin-watch';
import terser from '@rollup/plugin-terser';
import yargs from 'yargs';
import { mergeObjects } from '@arpadroid/tools/src/objectTool.js';
import { logError } from '../../utils/terminalLogger.mjs';

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
export function getBuild(projectName, buildName, config = {}) {
    if (typeof rollupBuilds[buildName] !== 'function') {
        logError(`Invalid build name: ${buildName}`);
        return;
    }
    const buildConfig = getBuildConfig(config);
    const project = new Project(projectName, buildConfig);
    const appBuild = rollupBuilds[buildName](project, buildConfig);
    const typesBuild = getTypesBuild();
    const build = [appBuild, typesBuild].filter(Boolean);
    return { build, plugins: appBuild.plugins, appBuild, typesBuild, project, buildConfig };
}

/**
 * Returns the build configuration.
 * @param {Record<string, unknown>} config
 * @returns {Record<string, unknown>}
 */
export function getBuildConfig(config = {}) {
    const envConfig = JSON.parse(process.env['ARPADROID_BUILD_CONFIG'] ?? '{}');
    const defaultConfig = mergeObjects(
        {
            slim: isSlim(),
            production: PROD,
            watch: shouldWatch()
        },
        envConfig
    );
    const rv = mergeObjects(defaultConfig, config);
    if (!rv.slim && DEPS) {
        rv.deps = preProcessDependencies(DEPS);
    }
    return rv;
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
        const depPath = path.join('node_modules', '@arpadroid', dep, 'dist', `arpadroid-${dep}.js`);
        if (fs.existsSync(path.join(cwd, depPath))) {
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
    const { watch = WATCH, deps } = config;
    const plugins = [
        nodeResolve({ browser: true, preferBuiltins: false }),
        watch && fs.existsSync(path.join(cwd, 'src', 'themes')) && rollupWatch({ dir: 'src/themes' }),
        watch && getWatchers(deps),
        deps.length && multiEntry(),
        bundleStats()
    ];
    return plugins.filter(Boolean);
}

export function getWatchers(deps) {
    return deps.map(dep => {
        const depPath = path.join(cwd, 'node_modules', '@arpadroid', dep, 'src', `themes`);
        if (fs.existsSync(depPath)) {
            return rollupWatch({ dir: depPath });
        }
        return null;
    });
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
