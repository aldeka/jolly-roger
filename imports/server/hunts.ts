import { Accounts } from 'meteor/accounts-base';
import { check } from 'meteor/check';
import { Email } from 'meteor/email';
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/nicolaslopezj:roles';
import Ansible from '../ansible';
import Hunts from '../lib/models/hunts';
import Profiles from '../lib/models/profiles';
import { HuntType } from '../lib/schemas/hunts';
import List from './blanche';

const existingJoinEmail = (user: Meteor.User | null, hunt: HuntType, joinerName: string | null) => {
  const email = user && user.emails && user.emails[0] && user.emails[0].address;
  const huntExcerpt = 'You\'ve also been put onto a handful of mailing lists for communications ' +
    'about these and future hunts:\n' +
    '\n' +
    `${hunt.mailingLists.join(', ')}\n` +
    '\n';

  return 'Hi!\n' +
    '\n' +
    'Karen or someone close to her has invited you to join our puzzlehunting website.\n' +
    '\n' +
    'To create your account, simply click the link below, fill out a few details for us, and ' +
    'click "Register".\n' +
    '\n' +
    `${url}\n` +
    '\n' +
    `${huntNames.length !== 0 ? huntExcerpt : ''}` +
    `${huntLists.length !== 0 ? listExcerpt : ''}` +
    'After you\'ve registered your account, you can keep it permanently. We\'ll use it if you ' +
    'hunt with us again.\n' +
    '\n' +
    'Let us know if you run into any major bugs at aldeka@aldeka.net.\n' +
    '\n' +
    'Happy Puzzling,\n' +
    '- The Jolly Roger Web Team\n' +
    '\n' +
    `This message was sent to ${email}`;
};

Meteor.methods({
  addToHunt(huntId: unknown, email: unknown) {
    check(huntId, String);
    check(email, String);
    check(this.userId, String);

    const hunt = Hunts.findOne(huntId);
    if (!hunt) {
      throw new Meteor.Error(404, 'Unknown hunt');
    }

    Roles.checkPermission(this.userId, 'hunt.join', huntId);

    let joineeUser = <Meteor.User | undefined>Accounts.findUserByEmail(email);
    const newUser = joineeUser === undefined;
    if (!joineeUser) {
      const joineeUserId = Accounts.createUser({ email });
      joineeUser = Meteor.users.findOne(joineeUserId)!;
    }
    if (!joineeUser._id) throw new Meteor.Error(500, 'Something has gone terribly wrong');

    if (joineeUser.hunts.includes(huntId)) {
      Ansible.log('Tried to add user to hunt but they were already a member', {
        joiner: this.userId,
        joinee: joineeUser._id,
        hunt: huntId,
      });
      return;
    }

    Ansible.log('Adding user to hunt', {
      joiner: this.userId,
      joinee: joineeUser._id,
      hunt: huntId,
    });
    Meteor.users.update(joineeUser._id, { $addToSet: { hunts: { $each: [huntId] } } });
    const joineeEmails = (joineeUser.emails || []).map((e) => e.address);

    hunt.mailingLists.forEach((listName) => {
      const list = new List(listName);
      joineeEmails.forEach((joineeEmail) => {
        if (!list.add(joineeEmail)) {
          Ansible.log('Unable to add user to list', { joineeEmail, list: listName });
        }
      });
    });

    if (newUser) {
      Accounts.sendEnrollmentEmail(joineeUser._id);
      Ansible.info('Sent invitation email to new user', { invitedBy: this.userId, email });
    } else if (joineeUser._id !== this.userId) {
      const joinerProfile = Profiles.findOne(this.userId);
      const joinerName = joinerProfile && joinerProfile.displayName !== '' ?
        joinerProfile.displayName :
        null;
      //      Email.send({
      //        from: Accounts.emailTemplates.from,
      //        to: email,
      //        subject: `[jolly-roger] Added to ${hunt.name} on ${Accounts.emailTemplates.siteName}`,
      //        text: existingJoinEmail(joineeUser, hunt, joinerName),
      //      });
    }
  },
});
