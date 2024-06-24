import { usagePanelDecorator } from './decorators';

/** @type { import('@storybook/web-components').Preview } */
const preview = {
    decorators: [usagePanelDecorator()],
    parameters: {
        layout: 'padded', //'centered' | 'fullscreen' | 'padded'
        options: {
            storySort: {
                // order: ['Components', 'Fields']
            }
        },
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i
            }
        }
    }
};

export default preview;
