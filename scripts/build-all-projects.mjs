import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ProjectBuilder from '../src/projectBuilder/projectBuilder.js';
const argv = yargs(hideBin(process.argv)).argv;
const projectBundler = new ProjectBuilder();
const EXCEPT = argv.except;
projectBundler.buildPackages({ exceptions: EXCEPT });
