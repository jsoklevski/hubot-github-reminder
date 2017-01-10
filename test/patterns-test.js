'use strict';

require('chai').should();

var patterns = require('../lib/patterns.js');

describe(__filename, function() {

  describe('INIT_CACHE pattern', function() {

    it('should match "github init cache"', function() {
      patterns.INIT_CACHE.should.eql(/github init cache/i);
    });

  });

  describe('DELETE_REMINDERS pattern', function() {

    it('should match "github delete all reminders"', function() {
      patterns.DELETE_REMINDERS.should.eql(/github delete all reminders/i);
    });

  });

  describe('DELETE_REMINDER pattern', function() {

    it('should match "github delete <time>"', function() {
      patterns.DELETE_REMINDER.should.eql(/github delete ([0-5]?[0-9]:[0-5]?[0-9]) reminder/i);
    });

  });

  describe('CREATE_REMINDER pattern', function() {

    it('should match "github remind <time>"', function() {
      patterns.CREATE_REMINDER.should.eql(/github remind ((?:[01]?[0-9]|2[0-4]):[0-5]?[0-9])$/i);
    });

  });

  describe('BOT_HELP pattern', function() {

    it('should match "github list reminders"', function() {
      patterns.BOT_HELP.should.eql(/github help/i);
    });

  });

  describe('LIST_OPEN_PR pattern', function() {

    it('should be "github list open pr"', function() {
      patterns.LIST_OPEN_PR.should.eql(/github list open pr/i);
    });

  });

  describe('REMEMBER_USER pattern', function() {

    it('should be "github I am <user>"', function() {
      patterns.REMEMBER_USER.should.eql(/github I am (.*)/i);
    });

  });

});
