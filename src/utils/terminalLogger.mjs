import chalk from 'chalk';

// #region Log Styles

export function headingLog(text) {
    return chalk.bold.hex('#b7f2ff')(text);
}

export function subjectLog(text) {
    return chalk.hex('#85c0fb')(text);
}

export function taskLog(text) {
    return chalk.hex('#b7f2ff')(text);
}

export function errorLog(text) {
    return chalk.bold.red(text);
}

export function successLog(text) {
    return chalk.bold.hex('#90ee90')(text);
}

export function mutedLog() {
    return chalk.gray;
}

export function warningLog() {
    return chalk.yellow;
}

export function infoLog() {
    return chalk.blue;
}

export function highlightLog() {
    return chalk.bold;
}

export function pkgLog(text) {
    return chalk.bold.underline.hex('#85c0fb')(text);
}

export function depLog(text) {
    return chalk.bold.underline.hex('#d9b4fe')(text);
}

export function taskSubject(text) {
    return `[${subjectLog(text)}]->`;
}

// #endregion

// #region Log Functions

export function clearLast() {
    process.stdout.moveCursor(0, -1);
    process.stdout.clearLine(1);
}

export function logTask(subject, text) {
    console.log(taskSubject(subject), taskLog(text));
}

export function logError(text, payload) {
    console.error(errorLog(text), payload);
}

export function logSuccess(text) {
    console.log(successLog(text));
}

export function logInfo(text) {
    console.log(infoLog(text));
}

// #endregion
