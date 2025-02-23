/**
 * @typedef {import('../../projectBuilder/project.mjs').default} Project
 */

/**
 * Creates a stylesheet out of any CSS files in the project.
 * @param {Project} project
 * @param {Record<string, unknown>} config
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
