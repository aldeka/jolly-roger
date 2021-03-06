import { _ } from 'meteor/underscore';
import React from 'react';
import { PuzzleType } from '../../lib/schemas/puzzles';
import { TagType } from '../../lib/schemas/tags';
import RelatedPuzzleGroup from './RelatedPuzzleGroup';

/* eslint-disable max-len */

interface RelatedPuzzleGroupsProps {
  activePuzzle: PuzzleType;
  allPuzzles: PuzzleType[];
  allTags: TagType[];
  canUpdate: boolean;
  layout: 'grid' | 'table';
}

class RelatedPuzzleGroups extends React.Component<RelatedPuzzleGroupsProps> {
  static displayName = 'RelatedPuzzleGroups';

  static defaultProps = {
    layout: 'grid',
  };

  relatedPuzzlesTagInterestingness = (tag: TagType, metaForTagIfKnown: TagType | null | undefined) => {
    // Maps a tag into an interestingness class.  Smaller numbers are more interesting.
    // group: tags go at the beginning of the list, because you're
    // most interested in the other puzzles from this meta/round.
    if (tag.name.lastIndexOf('group:', 0) === 0) {
      // If this puzzle has a meta-for:<something> tag, prioritize the
      // meta:<something> tag over all the others.
      if (metaForTagIfKnown) {
        const metaTagName = metaForTagIfKnown.name.slice('meta-for:'.length);
        const thisMetaName = tag.name.slice('group:'.length);
        if (metaTagName === thisMetaName) {
          return -2;
        }
      }

      return -1;
    } else {
      // Otherwise, use sort order
      return 0;
    }
  };

  sortedTagsForRelatedPuzzles = (tags: TagType[]) => {
    // Clone a copy of the tags.
    const tagList = tags.slice(0);

    // Look for a tag that starts with 'meta-for:'.
    const metaForTag = tags.find((tag) => { return tag.name.lastIndexOf('meta-for:', 0) === 0; });

    tagList.sort((a, b) => {
      const ia = this.relatedPuzzlesTagInterestingness(a, metaForTag);
      const ib = this.relatedPuzzlesTagInterestingness(b, metaForTag);
      if (ia !== ib) {
        return ia - ib;
      } else {
        // Just sort lexically within interestingness classes.
        return a.name.localeCompare(b.name);
      }
    });

    return tagList;
  };

  puzzlesWithTagIdExcept = (puzzles: PuzzleType[], tagId: string, puzzleId: string) => {
    return puzzles.filter((p) => {
      return p._id !== puzzleId && p.tags.indexOf(tagId) !== -1;
    });
  };

  render() {
    // For each tag, collect all the other puzzles that also have that tag.
    const groups = [];
    const tagIndex = _.indexBy(this.props.allTags, '_id');

    // TODO: sort the tag groups by tag interestingness, which should probably be related to meta
    // presence/absence, tag group size, and number of solved/unsolved?
    const activePuzzleTags = this.sortedTagsForRelatedPuzzles(this.props.activePuzzle.tags.map((tagId) => {
      return tagIndex[tagId];
    }).filter(Boolean));

    for (let tagi = 0; tagi < activePuzzleTags.length; tagi++) {
      const tag = activePuzzleTags[tagi];
      const puzzles = this.puzzlesWithTagIdExcept(this.props.allPuzzles, tag._id, this.props.activePuzzle._id);

      // Only include a tag/puzzleset if there are actually puzzles other than the activePuzzle
      // that hold this tag.
      if (puzzles.length) {
        groups.push({ tag, puzzles });
      }
    }

    // We also should probably have some ability to hide the current puzzle from a puzzle group, if
    // we're in a puzzle details page and just looking at related puzzles.  No need to waste
    // precious space on the current puzzle again.

    // Then, render tag group.

    return (
      <div>
        {
          groups.length ? groups.map((g) => {
            return (
              <RelatedPuzzleGroup
                key={g.tag._id}
                sharedTag={g.tag}
                relatedPuzzles={g.puzzles}
                allTags={this.props.allTags}
                includeCount
                layout={this.props.layout}
                canUpdate={this.props.canUpdate}
              />
            );
          }) : <span>No tags for this puzzle yet.</span>
        }
      </div>
    );
  }
}

export default RelatedPuzzleGroups;
