import React from 'react';
import PropTypes from 'prop-types';
import { withTracker } from 'meteor/react-meteor-data';
import subsCache from '../subsCache.js';
import navAggregatorType from './navAggregatorType.jsx';
import ProfileList from './ProfileList.jsx';
import ProfileSchema from '../../lib/schemas/profiles.js';
import Profiles from '../../lib/models/profiles.js';

class AllProfileListPage extends React.Component {
  static propTypes = {
    ready: PropTypes.bool.isRequired,
    profiles: PropTypes.arrayOf(PropTypes.shape(ProfileSchema.asReactPropTypes())).isRequired,
  };

  static contextTypes = {
    navAggregator: navAggregatorType,
  };

  render() {
    let body;
    if (!this.props.ready) {
      body = <div>loading...</div>;
    } else {
      body = <ProfileList profiles={this.props.profiles} />;
    }

    return (
      <this.context.navAggregator.NavItem
        itemKey="users"
        to="/users"
        label="Users"
        depth={0}
      >
        {body}
      </this.context.navAggregator.NavItem>
    );
  }
}

export default withTracker(() => {
  const profilesHandle = subsCache.subscribe('mongo.profiles');
  const ready = profilesHandle.ready();
  const profiles = ready ? Profiles.find({}, { sort: { displayName: 1 } }).fetch() : [];
  return {
    ready,
    profiles,
  };
})(AllProfileListPage);
