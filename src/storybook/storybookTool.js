/**
 * @typedef {import('./storybookTool.types.js').StoryContextType} StoryContextType
 */
import { mergeObjects } from '@arpadroid/tools/object';

/**
 * Returns the context object for the current story.
 * @returns {StoryContextType} The story context.
 */
function getContext() {
    const _window = window.parent;
    if (!_window._storyContext) {
        _window._storyContext = {};
    }
    return _window._storyContext;
}

/**
 * Returns an object with data associated with the story.
 * @param {string} id - The story id.
 * @returns {StoryContextType | undefined} The story context.
 */
export function getStoryContext(id = '') {
    if (!id) {
        return;
    }
    const StoryContext = getContext();
    if (id && typeof StoryContext[id] === 'undefined') {
        StoryContext[id] = {};
    }
    return StoryContext[id];
}

/**
 * Sets the context object for the specified story id.
 * @param {string} id - The story id.
 * @param {StoryContextType} payload - The data to be set in the story context.
 * @returns {StoryContextType} The updated story context.
 */
export function setStoryContext(id, payload) {
    const context = getContext();
    context[id] = payload;
    return context[id];
}

/**
 * Edits the context object for the specified story id by merging the existing data with the new payload.
 * @param {string} id - The story id.
 * @param {StoryContextType} payload - The data to be merged with the existing story context.
 * @returns {StoryContextType | undefined} The updated story context.
 */
export function editStoryContext(id, payload) {
    const context = getContext();
    const storyContext = getStoryContext(id);
    if (storyContext) {
        context[id] = mergeObjects(storyContext, payload);
        return context[id];
    }
}

/**
 * Returns the value associated with the specified key in the story context.
 * @param {string} id - The story id.
 * @param {string} key - The key to retrieve the value from the story context.
 * @returns {unknown} The value associated with the key in the story context.
 */
export function getStoryContextValue(id, key) {
    const context = getStoryContext(id) ?? {};
    return context[key];
}

/**
 * Sets the value associated with the specified key in the story context.
 * @param {string} id - The story id.
 * @param {string} key - The key to set the value in the story context.
 * @param {unknown} value - The value to be set in the story context.
 * @returns {StoryContextType | undefined} The updated story context.
 */
export function setStoryContextValue(id, key, value) {
    return editStoryContext(id, { [key]: value });
}
