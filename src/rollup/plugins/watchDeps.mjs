import chalk from 'chalk';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Watches for changes in the project's dependencies and rebuilds the styles.
 * @returns {import('rollup').Plugin}
 */
export default function watchDeps(project, config) {
    return {
        name: 'watch-deps',
        buildEnd() {
            const deps = project.getArpadroidDependencies();
            deps.forEach(dep => {
                const filePath = `node_modules/@arpadroid/${dep}/dist/arpadroid-${dep}.js`;

                if (existsSync(filePath)) {
                    console.log(chalk.yellow.bold('watching'), filePath);
                    this.addWatchFile(filePath);
                }
            });
        }
    };
}
