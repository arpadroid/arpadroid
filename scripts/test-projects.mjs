/* eslint-disable security/detect-non-literal-fs-filename */
import Project from '../src/projectBuilder/project.mjs';
import fs from 'fs';
import { log } from '../src/utils/terminalLogger.mjs';

const cwd = process.cwd();

const arpadroid = new Project('arpadroid');
const projects = arpadroid.getArpadroidDependencies().map(dep => {
    return new Project(dep, { path: fs.realpathSync(`${cwd}/../${dep}`) });
});

/**
 * Run tests for all projects.
 */
async function runTests() {
    const project = projects.shift();
    try {
        await project.test();
    } catch (error) {
        log.error(error);
    }
    if (projects.length) {
        runTests();
    }
}

runTests();
