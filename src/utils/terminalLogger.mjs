import chalk from 'chalk';

// #region Log Styles

/**
 * Returns a styled heading log text.
 * @param {string} text - The text to style.
 * @returns {string} - The styled text.
 */
export function headingLog(text) {
    return chalk.bold.hex('#b7f2ff')(text);
}

/**
 * Returns a styled subject log text.
 * @param {string} text - The text to style.
 * @returns {string} - The styled text.
 */
export function subjectLog(text) {
    return chalk.hex('#85c0fb')(text);
}

/**
 * Returns a styled task log text.
 * @param {string} text - The text to style.
 * @returns {string} - The styled text.
 */
export function taskLog(text) {
    return chalk.hex('#b7f2ff')(text);
}

/**
 * Returns a styled error log text.
 * @param {string} text - The text to style.
 * @returns {string} - The styled text.
 */
export function errorLog(text) {
    return chalk.bold.red(text);
}

/**
 * Returns a styled success log text.
 * @param {string} text - The text to style.
 * @returns {string} - The styled text.
 */
export function successLog(text) {
    return chalk.bold.hex('#90ee90')(text);
}

/**
 * Returns a styled muted log text.
 * @param {string} text - The text to style.
 * @returns {string} - The styled text.
 */
export function mutedLog(text) {
    return chalk.gray(text);
}

/**
 * Returns a styled warning log text.
 * @param {string} text - The text to style.
 * @returns {string} - The styled text.
 */
export function warningLog(text) {
    return chalk.yellow(text);
}

/**
 * Returns a styled info log text.
 * @param {string} text - The text to style.
 * @returns {string} - The styled text.
 */
export function infoLog(text) {
    return chalk.hex('#85c0fb')(text);
}

/**
 * Returns a styled highlight log text.
 * @param {string} text - The text to style.
 * @returns {string} - The styled text.
 */
export function highlightLog(text) {
    return chalk.bold(text);
}

// #endregion

// #region Log Methods

/**
 * Clears the last line in the terminal.
 */
export function clearLast() {
    process.stdout.moveCursor(0, -1);
    process.stdout.clearLine(1);
}

/**
 * Logs an error message with an optional payload.
 * @param {string} text - The error message.
 * @param {*} [payload] - Additional payload to log.
 */
export function logError(text, payload) {
    console.error(errorLog(text), payload);
}

/**
 * Logs a success message.
 * @param {string} text - The success message.
 */
export function logSuccess(text) {
    console.log(successLog(text));
}

/**
 * Logs an informational message.
 * @param {string} text - The informational message.
 */
export function logInfo(text) {
    console.log(infoLog(text));
}

// #endregion

// #region Task Logs

/**
 * Returns a styled package log text.
 * @param {string} text - The text to style.
 * @returns {string} - The styled text.
 */
export function pkgLog(text) {
    return chalk.bold.underline.hex('#85c0fb')(text);
}

/**
 * Returns a styled dependency log text.
 * @param {string} text - The text to style.
 * @returns {string} - The styled text.
 */
export function depLog(text) {
    return chalk.bold.underline.hex('#d9b4fe')(text);
}

/**
 * Returns a styled task subject text.
 * @param {string} text - The text to style.
 * @param {string} prefix The prefix to add to the text.
 * @returns {string} - The styled text.
 */
export function taskSubjectLog(text, prefix = '@arpadroid/') {
    return `[${subjectLog(prefix)}${depLog(text)}] =>`;
}

/**
 * Logs a task with a subject and text.
 * @param {string} subject - The subject of the task.
 * @param {string} text - The text of the task.
 */
export function logTask(subject, text) {
    console.log(taskSubjectLog(subject), taskLog(text));
}

// #endregion

/**
 * Returns an Arpadroid ASCII art.
 * @returns {string} - The ASCII art.
 */
export function arpadroidLog() {
    return `            ┓    • ┓  
   ┏┓┏┓┏┓┏┓┏┫┏┓┏┓┓┏┫  
   ┗┻┛ ┣┛┗┻┗┻┛ ┗┛┗┗┻  
 ------┛---------------  `;
}

/**
 * Returns a bordered Arpadroid ASCII art.
 * @returns {string} - The bordered ASCII art.
 */
export function arpadroidLogBordered() {
    return ` ---------------------------
               ┓    • ┓  
      ┏┓┏┓┏┓┏┓┏┫┏┓┏┓┓┏┫  
      ┗┻┛ ┣┛┗┻┗┻┛ ┗┛┗┗┻  
          ┛              
 ---------------------------`;
}

/**
 * Logs the Arpadroid ASCII art.
 */
export function logArpadroid() {
    console.log(chalk.hex('#b7f2ff')(arpadroidLog()));
}

// #region Log Exports

export const log = {
    clearLast,
    error: logError,
    success: logSuccess,
    info: logInfo,
    task: logTask,
    arpadroid: logArpadroid
};

export const logStyle = {
    error: errorLog,
    success: successLog,
    info: infoLog,
    task: taskLog,
    pkg: pkgLog,
    dep: depLog,
    muted: mutedLog,
    warning: warningLog,
    highlight: highlightLog,
    heading: headingLog,
    subject: subjectLog,
    taskSubject: taskSubjectLog
};

// #endregion
