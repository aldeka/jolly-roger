import { Match, check } from 'meteor/check';
import { HTTP } from 'meteor/http';
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/nicolaslopezj:roles';
import { ServiceConfiguration } from 'meteor/service-configuration';
import Ansible from '../ansible';
import Flags from '../flags';

Meteor.methods({
  slackInvite() {
    if (!this.userId) {
      throw new Meteor.Error(403, 'Only logged in users can send slack invites');
    }

    const user = Meteor.users.findOne(this.userId);
    if (!user) {
      throw new Meteor.Error(404, 'Can not find user');
    }

    const email = user && user.emails && user.emails[0] && user.emails[0].address;
    if (!email) {
      throw new Meteor.Error(400, 'User does not have an email address on file');
    }

    const config = ServiceConfiguration.configurations.findOne({ service: 'slack' });
    if (!config) {
      throw new Meteor.Error(500, 'Slack is not configured; unable to send invite');
    }

    const circuitBroken = Flags.active('disable.slack');
    if (circuitBroken) {
      throw new Meteor.Error(500, 'Slack integration is currently disabled by the administrator; unable to send invite');
    }

    this.unblock();

    Ansible.log('Sending a Slack invite', { email, user: user._id, sender: this.userId });

    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    const result = HTTP.post('https://slack.com/api/users.admin.invite', {
      params: {
        token: config.secret,
        email,
        set_active: 'true',
      },
    });

    if (result.statusCode && result.statusCode >= 400) {
      Ansible.log('Error sending Slack invite', { content: result.content });
      throw new Meteor.Error(500, 'Something went wrong sending the invite');
    }
  },

  configureSlack(apiSecretKey: unknown) {
    check(this.userId, String);
    Roles.checkPermission(this.userId, 'slack.configureClient');

    // If given a null/undefined secret key, assume the intent is to disable
    // the Slack integration.
    check(apiSecretKey, Match.Maybe(String));

    if (apiSecretKey) {
      // Verify that the key works against the Slack API.
      const result = HTTP.post('https://slack.com/api/auth.test', {
        params: {
          token: apiSecretKey,
        },
      });

      if (result.statusCode !== 200 || !result.content) {
        throw new Meteor.Error(400, 'The Slack API rejected the token provided');
      }

      const resultObj = JSON.parse(result.content);
      if (resultObj.ok !== true) {
        throw new Meteor.Error(400, `The Slack API rejected the token provided: ${resultObj.error}`);
      }

      // If successful, apply the config
      ServiceConfiguration.configurations.upsert({ service: 'slack' }, {
        $set: {
          secret: apiSecretKey,
        },
      });
    } else {
      // Drop the slack configuration if there was any.
      ServiceConfiguration.configurations.remove({ service: 'slack' });
    }
  },
});
