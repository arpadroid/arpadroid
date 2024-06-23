import Project from '../../../projectBuilder/project.mjs';
/**
 * Creates a stylesheet out of any CSS files in the project.
 * @returns {import('rollup').Plugin}
 */
export default function buildStyles(projectName) {
    return {
        name: 'build-styles',
        buildEnd() {
            const project = new Project(projectName);
            project.buildStyles();
        }
    };
}
