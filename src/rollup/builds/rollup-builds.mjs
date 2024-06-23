import fs from 'fs';
import alias from '@rollup/plugin-alias';
import multiEntry from '@rollup/plugin-multi-entry';
import nodeResolve from '@rollup/plugin-node-resolve';
import watch from 'rollup-plugin-watch';
import { dts } from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import buildStyles from '../plugins/buildStyles/buildStyles.mjs';

const WATCH = Boolean(process.env['watch']);
const SLIM = Boolean(process.env['slim']);
const PROD = Boolean(process.env['production']);
const cwd = process.cwd();

export function getDependencies() {
    let deps = process.env['deps'];
    if (typeof deps === 'string') {
        deps = deps.split(',').map(dep => dep.trim());
    }
    return Array.isArray(deps) ? deps : [];
}

export function getInput(deps = getDependencies()) {
    const entry = 'src/index.js';
    if (SLIM || !deps.length) {
        return entry;
    }
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

export function getPlugins(projectName, deps = getDependencies()) {
    const plugins = SLIM
        ? [peerDepsExternal()]
        : [
              nodeResolve({ browser: true, preferBuiltins: false }),
              buildStyles(projectName),
              !PROD && WATCH && fs.existsSync(cwd + '/src/themes') && watch({ dir: 'src/themes' }),
              deps.length && multiEntry()
          ];
    return [terser({ keep_classnames: true }), ...plugins].filter(Boolean);
}

export function getOutput(projectName) {
    return {
        file: `dist/arpadroid-${projectName}.js`,
        format: 'es'
    };
}

export function getTypesBuild() {
    if (!fs.existsSync('src/types.d.ts')) {
        return null;
    }
    return {
        input: './src/types.d.ts',
        output: [{ file: 'dist/types.d.ts', format: 'es' }],
        plugins: [dts()]
    };
}

const rollupBuilds = {
    uiComponent(projectName, config = {}) {
        const deps = getDependencies();
        return {
            input: getInput(deps),
            plugins: getPlugins(projectName, deps),
            output: getOutput(projectName)
        };
    }
};

export function getBuild(projectName, buildName, config) {
    if (typeof rollupBuilds[buildName] !== 'function') {
        throw new Error(`Invalid build name: ${buildName}`);
    }
    const appBuild = rollupBuilds[buildName](projectName, config);
    const typesBuild = getTypesBuild();
    const build = [appBuild, typesBuild].filter(Boolean);
    return { build, plugins: appBuild.plugins };
}

export default rollupBuilds;
