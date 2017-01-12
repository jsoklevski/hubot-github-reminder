'use strict';


/**
 * @type {RegExp}
 */
exports.NOTIFICATIONS_SWITCH = /github (enable|disable)( notifications)?/i;


/**
 * @type {RegExp}
 */
exports.INIT_CACHE = /github init cache/i;


/**
 * @type {RegExp}
 */
exports.DELETE_REMINDERS = /github delete all reminders/i;


/**
 * @type {RegExp}
 */
exports.DELETE_REMINDER = /github delete ([0-5]?[0-9]:[0-5]?[0-9]) reminder/i;


/**
 * @type {RegExp}
 */
exports.CREATE_REMINDER = /github remind ((?:[01]?[0-9]|2[0-4]):[0-5]?[0-9])$/i;


/**
 * @type {RegExp}
 */
exports.LIST_REMINDERS = /github list reminders/i;


/**
 * @type {RegExp}
 */
exports.BOT_HELP = /github help/i;


/**
 * @type {RegExp}
 */
exports.LIST_OPEN_PR = /github list open pr/i;


/**
 * @type {RegExp}
 */
exports.LIST_MY_OPEN_PR = /github list my open pr/i;


/**
 * @type {RegExp}
 */
exports.REMEMBER_USER = /github I am (.*)/i;
