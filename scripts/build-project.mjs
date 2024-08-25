import Project from '../src/projectBuilder/project.mjs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
const argv = yargs(hideBin(process.argv)).argv;
const PROJECT = argv.project;
const LOG_HEADING = (argv?.logHeading && argv.logHeading !== 'false') ?? true;
if (!PROJECT) {
    console.log('No project option specified');
    process.exit(1);
}
const project = new Project(PROJECT);
project.build({ logHeading: LOG_HEADING });
