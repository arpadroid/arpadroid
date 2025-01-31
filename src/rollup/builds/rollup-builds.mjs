/* eslint-disable sonarjs/no-duplicate-string */
/**
 * @typedef {import('./rollup-builds.types').BuildConfigType} BuildConfigType
 * @typedef {import('./rollup-builds.types').BuildInterface} BuildInterface
 * @typedef {import('rollup').RollupOptions} RollupOptions
 * @typedef {import('rollup').Plugin} RollupPlugin
 */
/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
/**
 * Rollup plugins.
 */
import { bundleStats } from 'rollup-plugin-bundle-stats';
import gzipPlugin from 'rollup-plugin-gzip';
import { dts } from 'rollup-plugin-dts';
import multiEntry from '@rollup/plugin-multi-entry';
import nodeResolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
// @ts-ignore
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import rollupAlias from '@rollup/plugin-alias';
import rollupWatch from 'rollup-plugin-watch';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';
import { visualizer } from 'rollup-plugin-visualizer';
import buildStyles from '../plugins/buildStyles.mjs';
import typescript from 'rollup-plugin-typescript2';

import { mergeObjects } from '@arpadroid/tools/src/objectTool/objectTool.js';
import { logError } from '../../utils/terminalLogger.mjs';
import Project from '../../projectBuilder/project.mjs';

/** @type {{ watch?: boolean, slim?: boolean, deps?: string }} */
// @ts-ignore
const argv = yargs(hideBin(process.argv)).argv || {};
const cwd = process.cwd();
const DEPS = process.env.deps ?? argv?.deps ?? '';
const PROD = Boolean(process.env.production);
const SLIM = argv?.slim;
const WATCH = Boolean(!PROD && argv?.watch);

/**
 * Returns whether the build should be slim.
 * @returns {boolean}
 */
export function isSlim() {
    return Boolean((process.env.arpadroid_slim && process.env.arpadroid_slim === 'true') ?? SLIM);
}

/**
 * Returns whether the build should watch for changes.
 * @returns {boolean}
 */
export function shouldWatch() {
    return Boolean(process.env.arpadroid_watch ?? WATCH);
}

/**
 * Preprocesses the dependencies.
 * @param {string | string[]} deps
 * @returns {string[]}
 */
export function preProcessDependencies(deps = DEPS) {
    if (typeof deps === 'string') {
        deps = deps.split(',').map(dep => dep.trim());
    }
    return Array.isArray(deps) ? deps : [];
}

/**
 * Returns the build configuration.
 * @param {BuildConfigType} config
 * @returns {BuildConfigType}
 */
export function getBuildConfig(config = {}) {
    const envConfig = JSON.parse(process.env.ARPADROID_BUILD_CONFIG ?? '{}');
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
 * Logs the rollup build process.
 * @returns {RollupPlugin}
 */
export function debugPlugin() {
    return {
        name: 'debug',
        resolveId(source) {
            console.log('Resolving:', source);
            return null;
        },
        load(id) {
            console.log('Loading:', id);
            return null;
        }
    };
}

/**
 * Returns the configuration for the typescript types build.
 * @returns {RollupOptions}
 */
export function getTypesBuild() {
    const typesPath = path.join('src', 'types.d.ts');
    if (!fs.existsSync(typesPath)) {
        console.log('typesPath not found');
        return {};
    }
    /** @type {RollupOptions} */
    return {
        input: './src/types.d.ts',
        output: { file: path.join('dist', '@types/types.d.ts'), format: 'es' },
        plugins: [dts({ respectExternal: isSlim() })]
    };
}

/**
 * Returns the rollup input configuration.
 * @param {BuildConfigType} config
 * @param {Project} project
 * @returns {string | string[]}
 */
export function getInput(project, config = {}) {
    const { deps, slim } = config;
    const entry = 'src/index.js';
    if (slim || !deps?.length) {
        return entry;
    }
    const rv = [entry];
    deps.forEach(dep => {
        const depPath = path.join('node_modules', '@arpadroid', dep, 'dist', `arpadroid-${dep}.js`);
        const location = path.join(project.path, depPath);
        if (fs.existsSync(location)) {
            rv.push(depPath);
        } else {
            logError(`Dependency ${dep} not found`, { depPath });
        }
    });
    return rv;
}

/**
 * Returns the aliases for the project dependencies.
 * @param {string} [projectName]
 * @param {string[]} projects
 * @returns {RollupPlugin | undefined}
 */
export function getAliases(projectName, projects = []) {
    if (!Array.isArray(projects)) {
        logError('Invalid projects configuration, expecting an array instead got: ', projects);
    }
    const aliases = [
        projectName && { find: `@arpadroid/${projectName}`, replacement: path.resolve('./src/index.js') },
        projects?.map(dep => {
            if (typeof dep === 'string') {
                return {
                    find: `@arpadroid/${dep}`,
                    replacement: `${cwd}/node_modules/@arpadroid/${dep}/src/index.js`
                };
            }
            return dep;
        })
    ].filter(item => typeof item !== 'undefined');
    // @ts-ignore
    return aliases?.length ? rollupAlias({ entries: aliases }) : undefined;
}

/**
 * Returns the watchers for the project dependencies.
 * @param {string[]} envDeps
 * @param {Project} project
 * @returns {(RollupPlugin | null)[]}
 */
export function getWatchers(envDeps = [], project) {
    const deps = [...new Set(envDeps.concat(project.getArpadroidDependencies()))];
    return deps.map(dep => {
        const depPath = path.join(cwd, 'node_modules', '@arpadroid', dep, 'src', 'themes');
        return fs.existsSync(depPath) ? rollupWatch({ dir: depPath }) : null;
    });
}

/**
 * Returns the slim build rollup plugins configuration.
 * @param {Project} project
 * @param {BuildConfigType} config
 * @returns {RollupPlugin[]}
 */
export function getSlimPlugins(project, config = {}) {
    const { parent, aliases = [] } = config;
    const plugins = [peerDepsExternal(), nodeResolve({ browser: true, preferBuiltins: false })];
    const _aliases = getAliases(parent, aliases);
    plugins.push(_aliases);
    return plugins.filter(Boolean);
}

/**
 * Returns the fat build rollup plugins configuration.
 * @param {Project} project
 * @param {BuildConfigType} config
 * @returns {RollupPlugin[]}
 */
export function getFatPlugins(project, config) {
    const { watch = WATCH, deps, aliases } = config;

    /** @type {(RollupPlugin  | any)[]} */
    const plugins = [
        nodeResolve({ browser: true, preferBuiltins: false }),
        terser({
            keep_classnames: false
        }),
        watch && fs.existsSync(path.join(cwd, 'src', 'themes')) && rollupWatch({ dir: 'src/themes' }),
        Boolean(watch) && getWatchers(deps, project),
        deps && deps?.length > 0 && multiEntry(),
        bundleStats(),
        getAliases(project.name, aliases),
        copy({
            targets: [{ src: 'src/i18n', dest: 'dist' }]
        }),
        visualizer({
            emitFile: true,
            filename: 'stats.html'
        })
    ];

    return plugins.filter(Boolean);
}

/**
 * Returns the rollup plugins configuration.
 * @param {Project} project
 * @param {BuildConfigType} config
 * @returns {RollupPlugin[]}
 */
export function getPlugins(project, config) {
    const { slim, plugins = [] } = config;
    return [
        config.buildTypes === true &&
            typescript({
                tsconfig: './tsconfig.json', // Use the config defined earlier
                useTsconfigDeclarationDir: true
            }),
        json(),
        ...(slim ? getSlimPlugins(project, config) : getFatPlugins(project, config)),
        buildStyles(project, config),
        gzipPlugin(),
        ...plugins
    ].filter(plugin => plugin !== false);
}

/**
 * Returns the rollup output configuration.
 * @param {Project} project
 * @returns {import('rollup').OutputOptions}
 */
export function getOutput(project) {
    return {
        file: `dist/arpadroid-${project.name}.js`,
        format: 'esm'
        // preserveModules: true,
    };
}

/**
 * Returns the external dependencies.
 * @param {BuildConfigType} config
 * @returns {string[]}
 */
export function getExternal(config = {}) {
    const external = config?.external;
    if (isSlim()) {
        external?.push('context');
    }
    return (typeof external?.map === 'function' && external?.map(dep => `@arpadroid/${dep}`)) || [];
}

/**
 * Returns the default build configuration.
 * @param {Project} project
 * @param {BuildConfigType} config
 * @returns {import('rollup').RollupOptions}
 */
export function getBuildDefaults(project, config) {
    return {
        input: getInput(project, config),
        plugins: getPlugins(project, config),
        external: getExternal(config),
        output: getOutput(project),
        treeshake: true
    };
}

/**
 * Returns the polyfills build configuration.
 * @returns {RollupOptions}
 */
export function getPolyfillsBuild() {
    return {
        input: 'node_modules/@arpadroid/arpadroid/src/polyfills/polyfills.js',
        plugins: [nodeResolve({ browser: true, preferBuiltins: false }), terser({ keep_classnames: true })],
        output: {
            file: 'dist/arpadroid-polyfills.js',
            format: 'esm'
        }
    };
}

/**
 * Rollup builds.
 * The different builds that can be created for different applications.
 * @type {Record<string, (project: Project, config: BuildConfigType) => RollupOptions>}
 */
const rollupBuilds = {
    uiComponent(project, config = {}) {
        if (!isSlim()) {
            /**
             * Processes the builds.
             * @param {RollupOptions[]} builds
             */
            config.processBuilds = builds => {
                builds.push(getPolyfillsBuild());
            };
        }
        return { ...getBuildDefaults(project, config) };
    },
    library(project, config = {}) {
        return { ...getBuildDefaults(project, config) };
    }
};

/**
 * Returns the build configuration for the specified project and build.
 * @param {string} projectName
 * @param {'uiComponent' | 'library'} buildName
 * @param {BuildConfigType} config
 * @returns {BuildInterface | undefined}
 */
export function getBuild(projectName, buildName, config = {}) {
    const buildFn = rollupBuilds[buildName];
    if (typeof buildFn !== 'function') {
        logError(`Invalid build name: ${buildName}`);
        return;
    }
    const buildConfig = getBuildConfig(config);
    const project = new Project(projectName, buildConfig);
    const appBuild = buildFn(project, buildConfig);
    const typesBuild = getTypesBuild();
    const build = [appBuild].filter(Boolean);
    if (!isSlim() && typeof buildConfig.processBuilds === 'function') {
        buildConfig.processBuilds(build);
    }

    return {
        build,
        appBuild,
        typesBuild,
        project,
        buildConfig,
        plugins: appBuild.plugins,
        output: appBuild.output,
        Plugins: {
            bundleStats,
            dts,
            multiEntry,
            nodeResolve,
            peerDepsExternal,
            alias: rollupAlias,
            watch: rollupWatch,
            debugPlugin,
            terser
        }
    };
}

export default rollupBuilds;
