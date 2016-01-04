HuntMembershipVerifier = React.createClass({
  mixins: [ReactMeteorData],

  getMeteorData() {
    const userHandle = Meteor.subscribe('huntMembership');
    if (!userHandle.ready()) {
      return {ready: false};
    }

    const user = Meteor.user();
    if (!user) {
      return {ready: false};
    }

    if (!_.contains(user.hunts, this.props.params.huntId)) {
      return {
        member: false,
        ready: true,
      };
    }

    return {ready: true, member: true};
  },

  render() {
    if (!this.data.ready) {
      return <span>loading...</span>;
    } else if (!this.data.member) {
      return <HuntSignup huntId={this.props.params.huntId}/>;
    } else {
      return <div>{this.props.children}</div>;
    }
  },
});