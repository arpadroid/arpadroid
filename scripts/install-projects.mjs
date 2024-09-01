/* eslint-disable security/detect-non-literal-fs-filename */
import Project from '../src/projectBuilder/project.mjs';
import fs from 'fs';
import { log } from '../src/utils/terminalLogger.mjs';

const cwd = process.cwd();

const arpadroid = new Project('arpadroid');
const projects = arpadroid.getArpadroidDependencies().map(dep => {
    return new Project(dep, { path: fs.realpathSync(`${cwd}/../${dep}`) });
});

const _projects = [projects[0], projects[1]];

/**
 * Run tests for all projects.
 */
async function install() {
    const project = _projects.shift();
    console.log('project', project);
    // try {
    //     await project.install();
    // } catch (error) {
    //     log.error(error);
    // }
    // if (_projects.length) {
    //     install();
    // }
}

install();
