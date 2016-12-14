import { Meteor } from 'meteor/meteor';
import React from 'react';
import BS from 'react-bootstrap';
import { Link } from 'react-router';
import RRBS from 'react-router-bootstrap';
import { ReactMeteorData } from 'meteor/react-meteor-data';
import { JRPropTypes } from '/imports/client/JRPropTypes.js';
import { ConnectionStatus } from '/imports/client/components/ConnectionStatus.jsx';
import { NotificationCenter } from '/imports/client/components/NotificationCenter.jsx';

const LoadingSpinner = React.createClass({
  contextTypes: {
    subs: JRPropTypes.subs,
  },

  mixins: [ReactMeteorData],

  getMeteorData() {
    return { ready: this.context.subs.ready() };
  },

  render() {
    if (this.data.ready) {
      return <div />;
    }

    const style = {
      position: 'fixed',
      top: '0px',
      left: '0px',
      right: '0px',
      bottom: '0px',
      zIndex: '10000', // navbar is z index 1030
      backgroundColor: '#fff',
      opacity: 0.5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
    };
    return (
      <div style={style}>
        <h1>loading...</h1>
        <p>
          <img
            style={{ width: '100px', height: '100px' }}
            src="/images/spinner.gif"
            role="presentation"
          />
        </p>
      </div>
    );
  },
});

const SharedNavbar = React.createClass({
  contextTypes: {
    subs: JRPropTypes.subs,
  },

  mixins: [ReactMeteorData],

  getMeteorData() {
    const userId = Meteor.userId();
    const profileSub = this.context.subs.subscribe('mongo.profiles', { _id: userId });
    const profile = Models.Profiles.findOne(userId);
    const displayName = profileSub.ready() ?
        ((profile && profile.displayName) || '<no name given>') : 'loading...';
    return {
      userId,
      displayName,
    };
  },

  logout() {
    Meteor.logout();
  },

  render() {
    return (
      <BS.Navbar fixedTop>
        <BS.Navbar.Header>
          <BS.Navbar.Brand>
            <Link to="/">
              <img src="/images/brand.png" alt="Jolly Roger logo" />
            </Link>
          </BS.Navbar.Brand>
        </BS.Navbar.Header>
        <BS.Navbar.Collapse>
          {/* TODO: Construct some sort of breadcrumbs here? */}
          <BS.Nav>
            <RRBS.LinkContainer to="/hunts">
              <BS.NavItem>
                Hunts
              </BS.NavItem>
            </RRBS.LinkContainer>
            <RRBS.LinkContainer to="/users/">
              <BS.NavItem>
                Hunters
              </BS.NavItem>
            </RRBS.LinkContainer>
          </BS.Nav>
          <BS.Nav pullRight>
            <BS.NavDropdown
              id="profileDropdown"
              title={this.data.displayName}
            >
              <RRBS.LinkContainer to={`/users/${this.data.userId}`}>
                <BS.MenuItem eventKey="1">My Profile</BS.MenuItem>
              </RRBS.LinkContainer>
              <BS.MenuItem eventKey="2" onSelect={this.logout}>Sign out</BS.MenuItem>
            </BS.NavDropdown>
          </BS.Nav>
        </BS.Navbar.Collapse>
      </BS.Navbar>
    );
  },
});

// TODO: clean this up and dedupe navbar stuff when you figure out breadcrumbs
const FullscreenLayout = React.createClass({
  propTypes: {
    children: React.PropTypes.node,
  },

  render() {
    const { children, ...props } = this.props;
    return (
      <div>
        <NotificationCenter />
        <LoadingSpinner />
        <SharedNavbar {...props} />
        <div style={{ position: 'fixed', top: '50px', left: '0px', right: '0px', zIndex: '1' }}>
          <ConnectionStatus />
        </div>
        <div style={{ position: 'fixed', top: '50px', bottom: '0px', left: '0px', right: '0px' }}>
          {children}
        </div>
      </div>
    );
  },
});

const ScrollableLayout = React.createClass({
  propTypes: {
    children: React.PropTypes.node,
  },

  render() {
    const { children, ...props } = this.props;
    return (
      <div>
        <NotificationCenter />
        <LoadingSpinner />
        <SharedNavbar {...props} />
        <div className="container" style={{ paddingTop: '70px' }}>
          <ConnectionStatus />
          {children}
        </div>
      </div>
    );
  },
});

const App = React.createClass({
  propTypes: {
    routes: React.PropTypes.array,
  },
  render() {
    // Hack: see if the leaf route wants the fullscreen layout.
    const { routes, ...props } = this.props;
    const leafRoute = routes[routes.length - 1];
    const layout = leafRoute.component.desiredLayout;
    return (
      layout === 'fullscreen' ?
        <FullscreenLayout {...props} /> :
        <ScrollableLayout {...props} />
    );
  },
});

export { App };
