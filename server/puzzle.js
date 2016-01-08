function getOrCreateTagByName(huntId, name) {
  let existingTag = Models.Tags.findOne({hunt: huntId, name: name});
  if (existingTag) {
    return existingTag;
  }

  let newTagId = Models.Tags.insert({hunt: huntId, name: name});
  return {
    _id: newTagId,
    hunt: huntId,
    name: name,
  };
}

Meteor.methods({
  createPuzzle(huntId, title, url, tags) {
    check(this.userId, String);
    check(huntId, String);
    check(title, String);
    check(url, String);
    check(tags, [String]); // Note: tag names, not tag IDs.

    Roles.checkPermission(this.userId, 'mongo.puzzles.insert');

    // Look up each tag by name and map them to tag IDs.
    tagIds = tags.map((tagName) => { return getOrCreateTagByName(huntId, tagName); });

    var puzzle = Models.Puzzles.insert({
      hunt: huntId,
      tags: tagIds,
      title: title,
      url: url,
    });

    // TODO: run any puzzle-creation hooks, like creating a Slack channel, or creating a default
    // document attachment.
    // The Slack hook should add a Schemas.ChatMetadata with the appropriate slackChannel from the
    // response.
    // The websocket listening for Slack messages should subscribe to that channel.
    // For documents, we should have a documents collection, with a puzzleId, type, and
    // type-specific data.

    return puzzle;
  },

  addTagToPuzzle(puzzleId, newTagName) {
    // addTagToPuzzle takes a tag name, rather than a tag ID,
    // so we can avoid doing two round-trips for tag creation.
    check(this.userId, String);
    check(puzzleId, String);
    check(newTagName, String);

    // Look up which hunt the specified puzzle is from.
    hunt = Models.Puzzles.findOne({
      _id: puzzleId,
    }, {
      fields: {
        hunt: 1,
      },
    });
    let huntId = hunt && hunt.hunt;
    if (!huntId) throw new Error('No puzzle known with id ' + puzzleId);
    let tagId = getOrCreateTagByName(huntId, newTagName)._id;
    let changes = Models.Puzzles.update({
      _id: puzzleId,
    }, {
      $addToSet: {
        tags: tagId,
      },
    });
  },

  removeTagFromPuzzle(puzzleId, tagId) {
    // Note that removeTagFromPuzzle takes a tagId rather than a tag name,
    // since the client should already know the tagId.
    check(this.userId, String);
    check(puzzleId, String);
    check(tagId, String);
    Models.Puzzles.update({
      _id: puzzleId,
    }, {
      $pull: {
        tags: tagId,
      },
    });
  },
});