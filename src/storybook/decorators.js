/**
 * @typedef {import('@storybook/web-components-webpack5').StorybookConfig} StorybookConfig
 * @typedef {import('@storybook/web-components').StoryFn} StoryFn
 */
import { setStoryContextValue } from './storybookTool.js';
/**
 * A decorator that sets the usage panel for the story.
 * @returns {StoryFn}
 */
export function usagePanelDecorator() {
    return (story, config) => {
        const _story = typeof story === 'function' ? story() : story;
        setStoryContextValue(config.id, 'usage', _story);
        return _story;
    };
}

/**
 * Bootstraps the app.
 * @param {() => void} callback
 * @returns {StoryFn}
 */
export function bootstrapDecorator(callback) {
    let initialized = false;
    return story => {
        const _story = typeof story === 'function' ? story() : story;
        if (!initialized) {
            if (typeof callback === 'function') {
                callback();
            }
            initialized = true;
        }
        return _story;
    };
}
