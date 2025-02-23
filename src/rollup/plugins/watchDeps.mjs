import chalk from 'chalk';
import { existsSync } from 'fs';

/**
 * Watches for changes in the project's dependencies and rebuilds the styles.
 * @param {import('../../projectBuilder/project.mjs').default} project
 * @returns {import('rollup').Plugin}
 */
export default function watchDeps(project) {
    return {
        name: 'watch-deps',
        buildEnd() {
            const deps = project.getArpadroidDependencies();
            deps.forEach(dep => {
                const filePath = `node_modules/@arpadroid/${dep}/dist/arpadroid-${dep}.js`;
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                if (existsSync(filePath)) {
                    console.log(chalk.yellow.bold('watching'), filePath);
                    this.addWatchFile(filePath);
                }
            });
        }
    };
}
