import { Meteor } from 'meteor/meteor';
import React from 'react';
import PropTypes from 'prop-types';
import { withTracker } from 'meteor/react-meteor-data';
import Alert from 'react-bootstrap/lib/Alert';
import Badge from 'react-bootstrap/lib/Badge';
import Button from 'react-bootstrap/lib/Button';
import ControlLabel from 'react-bootstrap/lib/ControlLabel';
import FormControl from 'react-bootstrap/lib/FormControl';
import FormGroup from 'react-bootstrap/lib/FormGroup';
import navAggregatorType from './navAggregatorType.jsx';
import Flags from '../../flags.js';
import Settings from '../../lib/models/settings.js';

/* eslint-disable max-len, react/jsx-one-expression-per-line */

const googleCompletenessStrings = [
  'Unconfigured',
  '1/3 complete',
  '2/3 complete',
  'Configured',
];

class GoogleOAuthForm extends React.Component {
  static propTypes = {
    isConfigured: PropTypes.bool.isRequired,
    initialClientId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    const clientId = props.initialClientId || '';
    this.state = {
      submitState: 'idle',
      clientId,
      clientSecret: '',
    };
  }

  dismissAlert = () => {
    this.setState({ submitState: 'idle' });
  };

  onSubmitOauthConfiguration = (e) => {
    e.preventDefault();

    const clientId = this.state.clientId.trim();
    const clientSecret = this.state.clientSecret.trim();

    if (clientId.length > 0 && clientSecret.length === 0) {
      this.setState({
        submitState: 'error',
        submitError: 'You appear to be clearing the secret but not the client ID.  Please provide a secret.',
      });
    } else {
      this.setState({
        submitState: 'submitting',
      });
      Meteor.call('setupGoogleOAuthClient', clientId, clientSecret, (err) => {
        if (err) {
          this.setState({
            submitState: 'error',
            submitError: err.message,
          });
        } else {
          this.setState({
            submitState: 'success',
          });
        }
      });
    }
  };

  onClientIdChange = (e) => {
    this.setState({
      clientId: e.target.value,
    });
  };

  onClientSecretChange = (e) => {
    this.setState({
      clientSecret: e.target.value,
    });
  };

  render() {
    const shouldDisableForm = this.state.submitState === 'submitting';
    const secretPlaceholder = this.props.isConfigured ? '<configured secret not revealed>' : '';
    return (
      <form onSubmit={this.onSubmitOauthConfiguration}>
        {this.state.submitState === 'submitting' ? <Alert bsStyle="info">Saving...</Alert> : null}
        {this.state.submitState === 'success' ? <Alert bsStyle="success" onDismiss={this.dismissAlert}>Saved changes.</Alert> : null}
        {this.state.submitState === 'error' ? (
          <Alert bsStyle="danger" onDismiss={this.dismissAlert}>
            Saving failed:
            {' '}
            {this.state.submitError}
          </Alert>
        ) : null}
        <FormGroup>
          <ControlLabel htmlFor="jr-setup-edit-google-client-id">
            Client ID
          </ControlLabel>
          <FormControl
            id="jr-setup-edit-google-client-id"
            type="text"
            value={this.state.clientId}
            disabled={shouldDisableForm}
            onChange={this.onClientIdChange}
          />
        </FormGroup>
        <FormGroup>
          <ControlLabel htmlFor="jr-setup-edit-google-client-secret">
            Client secret
          </ControlLabel>
          <FormControl
            id="jr-setup-edit-google-client-secret"
            type="text"
            value={this.state.clientSecret}
            disabled={shouldDisableForm}
            onChange={this.onClientSecretChange}
            placeholder={secretPlaceholder}
          />
        </FormGroup>
        <Button bsStyle="primary" type="submit" disabled={shouldDisableForm} onSubmit={this.onSubmitOauthConfiguration}>
          Save
        </Button>
      </form>
    );
  }
}

class GoogleAuthorizeDriveClientForm extends React.Component {
  state = {
    submitState: 'idle',
    error: '',
  };

  dismissAlert = () => {
    this.setState({ submitState: 'idle' });
  };

  requestComplete = (token) => {
    const secret = OAuth._retrieveCredentialSecret(token);
    this.setState({ submitState: 'submitting' });
    Meteor.call('setupGdriveCreds', token, secret, (error) => {
      if (error) {
        this.setState({ submitState: 'error', error });
      } else {
        this.setState({ submitState: 'success' });
      }
    });
  };

  showPopup = () => {
    Google.requestCredential({
      requestPermissions: ['email', 'https://www.googleapis.com/auth/drive'],
      requestOfflineToken: true,
    }, this.requestComplete);
    return false;
  };

  render() {
    return (
      <div>
        {this.state.submitState === 'submitting' ? <Alert bsStyle="info">Saving...</Alert> : null}
        {this.state.submitState === 'success' ? <Alert bsStyle="success" onDismiss={this.dismissAlert}>Saved changes.</Alert> : null}
        {this.state.submitState === 'error' ? (
          <Alert bsStyle="danger" onDismiss={this.dismissAlert}>
            Saving failed:
            {' '}
            {this.state.error.message}
          </Alert>
        ) : null}
        <Button bsStyle="primary" onClick={this.showPopup}>Link a Google account</Button>
        for Google Drive management. (This will replace any previously configured account)
      </div>
    );
  }
}

class GoogleDriveTemplateForm extends React.Component {
  static propTypes = {
    initialDocTemplate: PropTypes.string,
    initialSpreadsheetTemplate: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {
      submitState: 'idle',
      docTemplate: props.initialDocTemplate || '',
      spreadsheetTemplate: props.initialSpreadsheetTemplate || '',
    };
  }

  dismissAlert = () => {
    this.setState({ submitState: 'idle' });
  };

  onSpreadsheetTemplateChange = (e) => {
    this.setState({
      spreadsheetTemplate: e.target.value,
    });
  };

  onDocTemplateChange = (e) => {
    this.setState({
      docTemplate: e.target.value,
    });
  };

  saveTemplates = (e) => {
    e.preventDefault();
    const ssTemplate = this.state.spreadsheetTemplate.trim();
    const ssId = ssTemplate.length > 0 ? ssTemplate : undefined;
    const docTemplateString = this.state.docTemplate.trim();
    const docId = docTemplateString.length > 0 ? docTemplateString : undefined;
    this.setState({
      submitState: 'submitting',
    });
    Meteor.call('setupGdriveTemplates', ssId, docId, (error) => {
      if (error) {
        this.setState({ submitState: 'error', error });
      } else {
        this.setState({ submitState: 'success' });
      }
    });
  };

  render() {
    const shouldDisableForm = this.state.submitState === 'submitting';
    return (
      <div>
        {this.state.submitState === 'submitting' ? <Alert bsStyle="info">Saving...</Alert> : null}
        {this.state.submitState === 'success' ? <Alert bsStyle="success" onDismiss={this.dismissAlert}>Saved changes.</Alert> : null}
        {this.state.submitState === 'error' ? (
          <Alert bsStyle="danger" onDismiss={this.dismissAlert}>
            Saving failed:
            {' '}
            {this.state.error.message}
          </Alert>
        ) : null}
        <FormGroup>
          <ControlLabel htmlFor="jr-setup-edit-gdrive-sheet-template">
            Spreadsheet template doc id
          </ControlLabel>
          <FormControl
            id="jr-setup-edit-gdrive-sheet-template"
            type="text"
            value={this.state.spreadsheetTemplate}
            disabled={shouldDisableForm}
            onChange={this.onSpreadsheetTemplateChange}
          />
        </FormGroup>
        <FormGroup>
          <ControlLabel htmlFor="jr-setup-edit-gdrive-doc-template">
            Document template doc id
          </ControlLabel>
          <FormControl
            id="jr-setup-edit-gdrive-doc-template"
            type="text"
            value={this.state.docTemplate}
            disabled={shouldDisableForm}
            onChange={this.onDocTemplateChange}
          />
        </FormGroup>
        <Button bsStyle="primary" onClick={this.saveTemplates} disabled={shouldDisableForm}>Save</Button>
      </div>
    );
  }
}

class GoogleIntegrationSection extends React.Component {
  static propTypes = {
    // oauth config
    oauthSettings: PropTypes.object,

    // gdrive credential
    gdriveCredential: PropTypes.object,

    // document template data
    docTemplate: PropTypes.string,
    spreadsheetTemplate: PropTypes.string,

    enabled: PropTypes.bool.isRequired,
  };

  onToggleEnabled = () => {
    const newValue = !this.props.enabled;
    const ffValue = newValue ? 'off' : 'on';
    Meteor.call('setFeatureFlag', 'disable.google', ffValue);
  };

  disconnectGdrive = () => {
    Meteor.call('clearGdriveCreds');
  };

  render() {
    const firstButtonLabel = this.props.enabled ? 'Enabled' : 'Enable';
    const secondButtonLabel = this.props.enabled ? 'Disable' : 'Disabled';
    const clientId = (this.props.oauthSettings && this.props.oauthSettings.clientId) || '';

    let stepsDone = 0;
    if (this.props.oauthSettings) {
      stepsDone += 1;
    }
    if (this.props.gdriveCredential) {
      stepsDone += 1;
    }
    if (this.props.spreadsheetTemplate) {
      stepsDone += 1;
    }

    const comp = googleCompletenessStrings[stepsDone];
    const oauthBadgeLabel = this.props.oauthSettings ? 'configured' : 'unconfigured';
    const driveBadgeLabel = this.props.gdriveCredential ? 'configured' : 'unconfigured';
    const maybeDriveUserEmail = this.props.gdriveCredential && this.props.gdriveCredential.value && this.props.gdriveCredential.value.email;
    const templateBadgeLabel = this.props.spreadsheetTemplate ? 'configured' : 'unconfigured';

    return (
      <section>
        <h1 className="setup-section-header">
          <span className="setup-section-header-label">
            Google integration
          </span>
          <Badge>
            {comp}
          </Badge>
          <span className="setup-section-header-buttons">
            <Button bsStyle="default" disabled={this.props.enabled} onClick={this.onToggleEnabled}>
              {firstButtonLabel}
            </Button>
            <Button bsStyle="default" disabled={!this.props.enabled} onClick={this.onToggleEnabled}>
              {secondButtonLabel}
            </Button>
          </span>
        </h1>
        <p>
          There are three pieces to Jolly Roger&apos;s Google integration capabilities:
        </p>
        <ol>
          <li>
            The OAuth client, which allows Jolly Roger to have users link
            their Google account to their Jolly Roger account.
          </li>
          <li>
            Google Drive automation, which automatically creates and shares
            spreadsheets and documents with users when they try to load that
            puzzle page in Jolly Roger.
          </li>
          <li>
            Template documents, which allow customizing the spreadsheet or
            doc to be used as a template when new puzzles are created.  This is
            particularly useful for making all cells use a monospace font by
            default.
          </li>
        </ol>

        <div className="gdrive-subsection">
          <h2 className="gdrive-subsection-header">
            <span>OAuth client</span>
            {' '}
            <Badge>{oauthBadgeLabel}</Badge>
          </h2>
          <p>
            Integrating with Google requires registering an app ID which
            identifies your Jolly Roger instance, and obtaining an app secret
            which proves to Google that you are the operator of this app.
          </p>
          <ul>
            <li>
              Follow <a href="https://support.google.com/googleapi/answer/6158849" target="_blank" rel="noopener noreferrer">Google&apos;s instructions</a> on how to create an app and register an OAuth 2.0 client.
              You can ignore the bit about &quot;Service accounts, web applications, and installed applications&quot;.
            </li>
            <li>Set <strong>Authorized JavaScript origins</strong> to <span>{Meteor.absoluteUrl('')}</span></li>
            <li>Set <strong>Authorized redirect URI</strong> to <span>{Meteor.absoluteUrl('/_oauth/google')}</span></li>
          </ul>
          <p>
            Then, copy the client ID and secret into the fields here and click the Save button.
          </p>
          <GoogleOAuthForm initialClientId={clientId} isConfigured={!!this.props.oauthSettings} />
        </div>

        <div className="gdrive-subsection">
          <h2 className="gdrive-subsection-header">
            <span>Drive user</span>
            {' '}
            <Badge>{driveBadgeLabel}</Badge>
          </h2>
          <p>
            Jolly Roger automates the creation of Google spreadsheets and
            documents for each puzzle, as well as sharing them with any viewer who
            has linked their Google account to their profile.
            To do so, Jolly Roger needs to be authenticated as some Google
            Drive user which will create and own each spreadsheet and document.
            In production, Death and Mayhem use a separate Google account not
            associated with any particular hunter for this purpose, and we
            recommend this setup.
          </p>
          {maybeDriveUserEmail && (
            <p>
              Currently connected as <strong>{maybeDriveUserEmail}</strong>. <Button onClick={this.disconnectGdrive}>Disconnect</Button>
            </p>
          )}
          <GoogleAuthorizeDriveClientForm />
        </div>

        <div className="gdrive-subsection">
          <h2 className="gdrive-subsection-header">
            <span>Document templates</span>
            {' '}
            <Badge>{templateBadgeLabel}</Badge>
          </h2>
          <p>
            Jolly Roger can create new documents for each puzzle it&apos; made aware of,
            but teams often would prefer that it make a new copy of some template document
            or spreadsheet.  For instance, you might use this to set the default typeface
            to be a monospace font, or to embed your team&apos;s set of Sheets macros, or
            whatever other script you may wish to integrate.
          </p>
          <ul>
            <li>If you wish to use templates, enter the document id (the part of a docs/sheets link after &quot;https://docs.google.com/document/d/&quot; and before &quot;/edit&quot;) for the appropriate template below and press Save.</li>
            <li>To disable templates, replace the template ID with an empty string and press Save.</li>
            <li>Template documents must be accessible by the Drive user connected above.</li>
          </ul>
          <GoogleDriveTemplateForm
            initialSpreadsheetTemplate={this.props.spreadsheetTemplate}
            initialDocTemplate={this.props.docTemplate}
          />
        </div>
      </section>
    );
  }
}

class SlackIntegrationSection extends React.Component {
  static propTypes = {
    configured: PropTypes.bool.isRequired,
    enabled: PropTypes.bool.isRequired,
  };

  state = {
    apiKeyValue: '',
    submitState: 'idle',
    submitError: '',
  };

  onToggleEnabled = () => {
    const newValue = !this.props.enabled;
    const ffValue = newValue ? 'off' : 'on';
    Meteor.call('setFeatureFlag', 'disable.slack', ffValue);
  };

  onApiKeyChange = (e) => {
    this.setState({
      apiKeyValue: e.target.value,
    });
  };

  onSaveApiKey = (e) => {
    e.preventDefault();
    this.setState({
      submitState: 'submitting',
    });

    Meteor.call('configureSlack', this.state.apiKeyValue.trim(), (err) => {
      if (err) {
        this.setState({
          submitState: 'error',
          submitError: err.message,
        });
      } else {
        this.setState({
          submitState: 'success',
        });
      }
    });
  };

  dismissAlert = () => {
    this.setState({
      submitState: 'idle',
      submitError: '',
    });
  };

  render() {
    const firstButtonLabel = this.props.enabled ? 'Enabled' : 'Enable';
    const secondButtonLabel = this.props.enabled ? 'Disable' : 'Disabled';

    const shouldDisableForm = this.state.submitState === 'submitting';

    return (
      <section>
        <h1 className="setup-section-header">
          <span className="setup-section-header-label">
            Slack integration
          </span>
          <Badge>
            {this.props.configured ? 'Configured' : 'Unconfigured'}
          </Badge>
          {this.props.configured && (
          <span className="setup-section-header-buttons">
            <Button bsStyle="default" disabled={this.props.enabled} onClick={this.onToggleEnabled}>
              {firstButtonLabel}
            </Button>
            <Button bsStyle="default" disabled={!this.props.enabled} onClick={this.onToggleEnabled}>
              {secondButtonLabel}
            </Button>
          </span>
          )}
        </h1>
        <p>
          Jolly Roger supports mirroring internal chat to Slack.  Hunts may configure a &quot;general&quot;
          channel where we&apos;ll send messages about puzzles being solved and new puzzles being added.
          Each hunt may additionally configure a &quot;firehose&quot; channel, where we&apos;ll mirror every chat
          message sent about any puzzle in that hunt, to make it easy for people to use Slack&apos;s dingwords
          to take note.
        </p>

        {this.state.submitState === 'submitting' ? <Alert bsStyle="info">Saving...</Alert> : null}
        {this.state.submitState === 'success' ? <Alert bsStyle="success" onDismiss={this.dismissAlert}>Saved changes.</Alert> : null}
        {this.state.submitState === 'error' ? (
          <Alert bsStyle="danger" onDismiss={this.dismissAlert}>
            Saving failed:
            {' '}
            {this.state.submitError}
          </Alert>
        ) : null}

        <FormGroup>
          <ControlLabel htmlFor="jr-setup-edit-slack-api-key">
            API key
          </ControlLabel>
          <FormControl
            id="jr-setup-edit-slack-api-key"
            type="text"
            placeholder="xoxp-..."
            value={this.state.apiKeyValue}
            disabled={shouldDisableForm}
            onChange={this.onApiKeyChange}
          />
        </FormGroup>
        <Button bsStyle="primary" type="submit" onClick={this.onSaveApiKey}>Save</Button>
      </section>
    );
  }
}

class CircuitBreakerControl extends React.Component {
  static propTypes = {
    // disabled should be false if the circuit breaker is not intentionally disabling the feature,
    // and true if the feature is currently disabled.
    // most features will have false here most of the time.
    featureDisabled: PropTypes.bool.isRequired,

    // What do you call this circuit breaker?
    title: PropTypes.string.isRequired,

    // some explanation of what this feature flag controls and why you might want to toggle it.
    children: PropTypes.node,

    // callback to call when the user requests changing this flag's state
    onChange: PropTypes.func.isRequired,
  };

  onChange = () => {
    const desiredState = !this.props.featureDisabled;
    this.props.onChange(desiredState);
  };

  render() {
    // Is the feature that this circuit breaker disables currently available?
    const featureIsEnabled = !this.props.featureDisabled;
    const firstButtonLabel = featureIsEnabled ? 'Enabled' : 'Enable';
    const secondButtonLabel = featureIsEnabled ? 'Disable' : 'Disabled';

    return (
      <div className="circuit-breaker">
        <div className="circuit-breaker-row">
          <div className="circuit-breaker-label">
            {this.props.title}
          </div>
          <div className="circuit-breaker-buttons">
            <Button bsStyle="default" disabled={featureIsEnabled} onClick={this.onChange}>
              {firstButtonLabel}
            </Button>
            <Button bsStyle="default" disabled={!featureIsEnabled} onClick={this.onChange}>
              {secondButtonLabel}
            </Button>
          </div>
        </div>
        <div className="circuit-breaker-description">
          {this.props.children}
        </div>
      </div>
    );
  }
}

class CircuitBreakerSection extends React.Component {
  static propTypes = {
    flagDisableGdrivePermissions: PropTypes.bool.isRequired,
    flagDisableSubcounters: PropTypes.bool.isRequired,
    flagDisableViewerLists: PropTypes.bool.isRequired,
    flagDisableApplause: PropTypes.bool.isRequired,
  };

  setFlagValue(flag, value) {
    const type = value ? 'on' : 'off';
    Meteor.call('setFeatureFlag', flag, type);
  }

  render() {
    return (
      <section>
        <h1 className="setup-section-header">
          Circuit breakers
        </h1>
        <p>
          Jolly Roger has several features which can be responsible for high
          server load or increased latency.  We allow them to be disabled at
          runtime to enable graceful degradation if your deployment is having
          issues.
        </p>
        <CircuitBreakerControl
          title="Drive permission sharing"
          featureDisabled={this.props.flagDisableGdrivePermissions}
          onChange={newValue => this.setFlagValue('disable.gdrive_permissions', newValue)}
        >
          <p>
            When Jolly Roger creates a spreadsheet or document, we grant
            anonymous access to the sheet or doc by link.  This has the unfortunate
            effect of making all viewers appear unidentified, e.g. Anonymous
            Aardvark, since otherwise Google Doc scripting tools could be used to
            harvest information about anyone who opens a link viewers.
          </p>
          <p>
            If, however, the document has already been explicitly shared with a particular google account,
            then that user&apos;s identity will be revealed in the document, which means you can see who it is
            editing or highlighting what cell in the spreadsheet and whatnot.
          </p>
          <p>
            Since sharing documents with N people in a hunt is N API calls, to
            avoid getting rate-limited by Google, we opt to do this sharing lazily
            when hunters open the puzzle page.
          </p>
          <p>
            Disabling this feature means that Jolly Roger will continue to
            create documents, but will not attempt to share them to users that have
            linked their Google identity.  As a result, new documents will show
            entirely anonymous animal users, and users looking at documents for the
            first time will also remain anonymous within the Google iframe.
          </p>
        </CircuitBreakerControl>
        <CircuitBreakerControl
          title="Viewer counts"
          featureDisabled={this.props.flagDisableSubcounters}
          onChange={newValue => this.setFlagValue('disable.subcounters', newValue)}
        >
          <p>
            To allow people to get a sense of how many people are looking at any given puzzle at a time,
            we track which users have which puzzle open, and send these aggregate counts to all viewers.
            This is expensive, because it fans out at O(tabs open to the site) per user navigation, which
            grows quickly.
          </p>
          <p>
            If you&apos;re seeing Jolly Roger getting slow under load, consider
            disabling this feature to reduce the total amount of work the server
            has to do.
          </p>
          <p>
            Disabling this feature means that Jolly Roger will no longer show
            viewer counts for puzzles.
          </p>
        </CircuitBreakerControl>
        <CircuitBreakerControl
          title="Viewer details"
          featureDisabled={this.props.flagDisableViewerLists}
          onChange={newValue => this.setFlagValue('disable.subfetches', newValue)}
        >
          <p>
            The Viewer counts feature also allows viewing which specific users are currently active
            on a puzzle.  This can cause additional server load.
          </p>
          <p>
            Disabling this feature means that Jolly Roger will no longer allow
            clicking on the viewer count on a puzzle page to bring up a list of
            which specific users are included in a particular view count.
          </p>
        </CircuitBreakerControl>
        <CircuitBreakerControl
          title="Celebrations"
          featureDisabled={this.props.flagDisableApplause}
          onChange={newValue => this.setFlagValue('disable.applause', newValue)}
        >
          <p>
            Some teams like broadcasting when a puzzle is solved, to make
            people aware of the shape of correct answers and to celebrate progress.
            Others do not, prefering to avoid distracting people or creating
            sound, especially since some puzzles involve audio cues.
            While individual users can squelch applause in their
            profile/settings, we also provide this global toggle if your team
            prefers to forgo this celebratory opportunity.
          </p>
          <p>
            Disabling this feature means that Jolly Roger will not show a modal
            and play an applause sound to all open tabs of all members of a
            particular hunt when a puzzle in that hunt is solved.
          </p>
        </CircuitBreakerControl>
      </section>
    );
  }
}

class SetupPageRewrite extends React.Component {
  static propTypes = {
    ready: PropTypes.bool.isRequired,

    canConfigure: PropTypes.bool.isRequired,

    googleConfig: PropTypes.object,
    gdriveCredential: PropTypes.object,
    docTemplate: PropTypes.string,
    spreadsheetTemplate: PropTypes.string,

    slackConfig: PropTypes.object,
    flagDisableSlack: PropTypes.bool.isRequired,

    flagDisableGoogleIntegration: PropTypes.bool.isRequired,
    flagDisableGdrivePermissions: PropTypes.bool.isRequired,
    flagDisableSubcounters: PropTypes.bool.isRequired,
    flagDisableViewerLists: PropTypes.bool.isRequired,
    flagDisableApplause: PropTypes.bool.isRequired,
  };

  static contextTypes = {
    navAggregator: navAggregatorType,
  };

  renderBody() {
    if (!this.props.ready) {
      return (
        <div className="setup-page">
          Loading...
        </div>
      );
    }


    if (!this.props.canConfigure) {
      return (
        <div className="setup-page">
          <h1>Not authorized</h1>
          <p>This page allows server admins to reconfigure the server, but you&apos;re not an admin.</p>
        </div>
      );
    }

    const slackConfigured = !!this.props.slackConfig;
    const slackEnabled = !this.props.flagDisableSlack;
    return (
      <div className="setup-page">
        <GoogleIntegrationSection
          oauthSettings={this.props.googleConfig}
          enabled={!this.props.flagDisableGoogleIntegration}
          gdriveCredential={this.props.gdriveCredential}
          docTemplate={this.props.docTemplate}
          spreadsheetTemplate={this.props.spreadsheetTemplate}
        />
        <SlackIntegrationSection
          configured={slackConfigured}
          enabled={slackEnabled}
        />
        <CircuitBreakerSection
          flagDisableGdrivePermissions={this.props.flagDisableGdrivePermissions}
          flagDisableSubcounters={this.props.flagDisableSubcounters}
          flagDisableViewerLists={this.props.flagDisableViewerLists}
          flagDisableApplause={this.props.flagDisableApplause}
        />
      </div>
    );
  }

  render() {
    return (
      <this.context.navAggregator.NavItem
        itemKey="setup"
        to="/setup"
        label="Server setup"
        depth={0}
      >
        {this.renderBody()}
      </this.context.navAggregator.NavItem>
    );
  }
}

export default withTracker(() => {
  const canConfigure = Roles.userHasRole(Meteor.userId(), 'admin');

  // We need to fetch the contents of the Settings table
  const settingsHandle = Meteor.subscribe('mongo.settings');

  // Google
  const googleConfig = ServiceConfiguration.configurations.findOne({ service: 'google' });
  const gdriveCredential = Settings.findOne({ name: 'gdrive.credential' });
  const docTemplate = Settings.findOne({ name: 'gdrive.template.document' });
  const spreadsheetTemplate = Settings.findOne({ name: 'gdrive.template.spreadsheet' });

  // Slack
  const slackConfig = ServiceConfiguration.configurations.findOne({ service: 'slack' });
  const flagDisableSlack = Flags.active('disable.slack');

  // Circuit breakers
  const flagDisableGoogleIntegration = Flags.active('disable.google');
  const flagDisableGdrivePermissions = Flags.active('disable.gdrive_permissions');
  const flagDisableSubcounters = Flags.active('disable.subcounters');
  const flagDisableViewerLists = Flags.active('disable.subfetches');
  const flagDisableApplause = Flags.active('disable.applause');

  return {
    ready: settingsHandle.ready(),

    canConfigure,

    googleConfig,
    gdriveCredential,
    docTemplate: docTemplate && docTemplate.value && docTemplate.value.id,
    spreadsheetTemplate: spreadsheetTemplate && spreadsheetTemplate.value && spreadsheetTemplate.value.id,

    slackConfig,
    flagDisableSlack,

    flagDisableGoogleIntegration,
    flagDisableGdrivePermissions,
    flagDisableSubcounters,
    flagDisableViewerLists,
    flagDisableApplause,
  };
})(SetupPageRewrite);
