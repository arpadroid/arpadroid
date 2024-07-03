import Project from '../../projectBuilder/project.mjs';
/**
 * Creates a stylesheet out of any CSS files in the project.
 * @returns {import('rollup').Plugin}
 */
export default function buildStyles(project, config) {
    return {
        name: 'build-styles',
        buildEnd() {
            project.buildStyles(config);
        }
    };
}
