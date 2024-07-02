import copy from 'rollup-plugin-copy';
import { getBuild } from './src/rollup/builds/rollup-builds.mjs';
const { build, plugins, appBuild } = getBuild('arpadroid');
export default build;
