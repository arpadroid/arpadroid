import { usagePanelDecorator } from './decorators.js';
import { mergeObjects } from '@arpadroid/tools/object';

/** @type { import('@storybook/web-components').Preview } */
const defaultConfig = {
    decorators: [usagePanelDecorator()],
    parameters: {
        layout: 'padded', //'centered' | 'fullscreen' | 'padded'
        options: {
            storySort: {}
        },
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i
            }
        }
    }
};
const config = JSON.parse(process?.env?.PROJECT_CONFIG ?? '{}')?.storybook?.preview ?? {};
const preview = mergeObjects(defaultConfig, config);
export default preview;
