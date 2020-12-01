import { Google } from 'meteor/google-oauth';
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/nicolaslopezj:roles';
import { OAuth } from 'meteor/oauth';
import { withTracker } from 'meteor/react-meteor-data';
import { ServiceConfiguration, Configuration } from 'meteor/service-configuration';
import { _ } from 'meteor/underscore';
import React from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import FormControl, { FormControlProps } from 'react-bootstrap/FormControl';
import FormGroup from 'react-bootstrap/FormGroup';
import FormLabel from 'react-bootstrap/FormLabel';
import { withBreadcrumb } from 'react-breadcrumbs-context';
import Flags from '../../flags';
import PublicSettings from '../../lib/models/public_settings';
import Settings from '../../lib/models/settings';
import { DiscordGuilds, DiscordGuildType } from '../discord';

/* eslint-disable max-len, react/jsx-one-expression-per-line */

enum SubmitState {
  IDLE = 'idle',
  SUBMITTING = 'submitting',
  SUCCESS = 'success',
  ERROR = 'error',
}

const googleCompletenessStrings = [
  'Unconfigured',
  '1/3 complete',
  '2/3 complete',
  'Configured',
];

interface GoogleOAuthFormProps {
  isConfigured: boolean;
  initialClientId?: string;
}

type GoogleOAuthFormState = {
  clientId: string;
  clientSecret: string;
} & ({
  submitState: SubmitState.IDLE | SubmitState.SUBMITTING | SubmitState.SUCCESS
} | {
  submitState: SubmitState.ERROR;
  submitError: string;
})

class GoogleOAuthForm extends React.Component<GoogleOAuthFormProps, GoogleOAuthFormState> {
  constructor(props: GoogleOAuthFormProps) {
    super(props);
    const clientId = props.initialClientId || '';
    this.state = {
      submitState: SubmitState.IDLE,
      clientId,
      clientSecret: '',
    } as GoogleOAuthFormState;
  }

  dismissAlert = () => {
    this.setState({ submitState: SubmitState.IDLE });
  };

  onSubmitOauthConfiguration = (e: React.FormEvent<any>) => {
    e.preventDefault();

    const clientId = this.state.clientId.trim();
    const clientSecret = this.state.clientSecret.trim();

    if (clientId.length > 0 && clientSecret.length === 0) {
      this.setState({
        submitState: SubmitState.ERROR,
        submitError: 'You appear to be clearing the secret but not the client ID.  Please provide a secret.',
      } as GoogleOAuthFormState);
    } else {
      this.setState({
        submitState: SubmitState.SUBMITTING,
      });
      Meteor.call('setupGoogleOAuthClient', clientId, clientSecret, (err?: Error) => {
        if (err) {
          this.setState({
            submitState: SubmitState.ERROR,
            submitError: err.message,
          } as GoogleOAuthFormState);
        } else {
          this.setState({
            submitState: SubmitState.SUCCESS,
          });
        }
      });
    }
  };

  onClientIdChange: FormControlProps['onChange'] = (e) => {
    this.setState({
      clientId: e.currentTarget.value,
    });
  };

  onClientSecretChange: FormControlProps['onChange'] = (e) => {
    this.setState({
      clientSecret: e.currentTarget.value,
    });
  };

  render() {
    const shouldDisableForm = this.state.submitState === SubmitState.SUBMITTING;
    const secretPlaceholder = this.props.isConfigured ? '<configured secret not revealed>' : '';
    return (
      <form onSubmit={this.onSubmitOauthConfiguration}>
        {this.state.submitState === SubmitState.SUBMITTING ? <Alert variant="info">Saving...</Alert> : null}
        {this.state.submitState === SubmitState.ERROR ? <Alert variant="success" dismissible onClose={this.dismissAlert}>Saved changes.</Alert> : null}
        {this.state.submitState === SubmitState.ERROR ? (
          <Alert variant="danger" dismissible onClose={this.dismissAlert}>
            Saving failed:
            {' '}
            {this.state.submitError}
          </Alert>
        ) : null}
        <FormGroup>
          <FormLabel htmlFor="jr-setup-edit-google-client-id">
            Client ID
          </FormLabel>
          <FormControl
            id="jr-setup-edit-google-client-id"
            type="text"
            value={this.state.clientId}
            disabled={shouldDisableForm}
            onChange={this.onClientIdChange}
          />
        </FormGroup>
        <FormGroup>
          <FormLabel htmlFor="jr-setup-edit-google-client-secret">
            Client secret
          </FormLabel>
          <FormControl
            id="jr-setup-edit-google-client-secret"
            type="text"
            value={this.state.clientSecret}
            disabled={shouldDisableForm}
            onChange={this.onClientSecretChange}
            placeholder={secretPlaceholder}
          />
        </FormGroup>
        <Button variant="primary" type="submit" disabled={shouldDisableForm} onSubmit={this.onSubmitOauthConfiguration}>
          Save
        </Button>
      </form>
    );
  }
}

type GoogleAuthorizeDriveClientFormState = {
  submitState: SubmitState.IDLE | SubmitState.SUBMITTING | SubmitState.SUCCESS;
} | {
  submitState: SubmitState.ERROR;
  error: Error;
}

class GoogleAuthorizeDriveClientForm extends React.Component<{}, GoogleAuthorizeDriveClientFormState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      submitState: SubmitState.IDLE,
    };
  }

  dismissAlert = () => {
    this.setState({ submitState: SubmitState.IDLE });
  };

  requestComplete = (token: string) => {
    const secret = OAuth._retrieveCredentialSecret(token);
    this.setState({ submitState: SubmitState.SUBMITTING });
    Meteor.call('setupGdriveCreds', token, secret, (error?: Error) => {
      if (error) {
        this.setState({ submitState: SubmitState.ERROR, error });
      } else {
        this.setState({ submitState: SubmitState.SUCCESS });
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
        {this.state.submitState === SubmitState.SUBMITTING ? <Alert variant="info">Saving...</Alert> : null}
        {this.state.submitState === SubmitState.SUCCESS ? <Alert variant="success" onClose={this.dismissAlert}>Saved changes.</Alert> : null}
        {this.state.submitState === SubmitState.ERROR ? (
          <Alert variant="danger" dismissible onClose={this.dismissAlert}>
            Saving failed:
            {' '}
            {this.state.error.message}
          </Alert>
        ) : null}
        <Button variant="primary" onClick={this.showPopup}>Link a Google account</Button>
        for Google Drive management. (This will replace any previously configured account)
      </div>
    );
  }
}

interface GoogleDriveTemplateFormProps {
  initialDocTemplate?: string;
  initialSpreadsheetTemplate?: string;
}

type GoogleDriveTemplateFormState = {
  docTemplate: string;
  spreadsheetTemplate: string;
} & ({
  submitState: SubmitState.IDLE | SubmitState.SUBMITTING | SubmitState.SUCCESS;
} | {
  submitState: SubmitState.ERROR;
  error: Error;
})

class GoogleDriveTemplateForm extends React.Component<GoogleDriveTemplateFormProps, GoogleDriveTemplateFormState> {
  constructor(props: GoogleDriveTemplateFormProps) {
    super(props);
    this.state = {
      submitState: SubmitState.IDLE,
      docTemplate: props.initialDocTemplate || '',
      spreadsheetTemplate: props.initialSpreadsheetTemplate || '',
    };
  }

  dismissAlert = () => {
    this.setState({ submitState: SubmitState.IDLE });
  };

  onSpreadsheetTemplateChange: FormControlProps['onChange'] = (e) => {
    this.setState({
      spreadsheetTemplate: e.currentTarget.value,
    });
  };

  onDocTemplateChange: FormControlProps['onChange'] = (e) => {
    this.setState({
      docTemplate: e.currentTarget.value,
    });
  };

  saveTemplates = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const ssTemplate = this.state.spreadsheetTemplate.trim();
    const ssId = ssTemplate.length > 0 ? ssTemplate : undefined;
    const docTemplateString = this.state.docTemplate.trim();
    const docId = docTemplateString.length > 0 ? docTemplateString : undefined;
    this.setState({
      submitState: SubmitState.SUBMITTING,
    });
    Meteor.call('setupGdriveTemplates', ssId, docId, (error?: Error) => {
      if (error) {
        this.setState({ submitState: SubmitState.ERROR, error } as GoogleDriveTemplateFormState);
      } else {
        this.setState({ submitState: SubmitState.SUCCESS });
      }
    });
  };

  render() {
    const shouldDisableForm = this.state.submitState === 'submitting';
    return (
      <div>
        {this.state.submitState === 'submitting' ? <Alert variant="info">Saving...</Alert> : null}
        {this.state.submitState === 'success' ? <Alert variant="success" dismissible onClose={this.dismissAlert}>Saved changes.</Alert> : null}
        {this.state.submitState === 'error' ? (
          <Alert variant="danger" dismissible onClose={this.dismissAlert}>
            Saving failed:
            {' '}
            {this.state.error.message}
          </Alert>
        ) : null}
        <FormGroup>
          <FormLabel htmlFor="jr-setup-edit-gdrive-sheet-template">
            Spreadsheet template doc id
          </FormLabel>
          <FormControl
            id="jr-setup-edit-gdrive-sheet-template"
            type="text"
            value={this.state.spreadsheetTemplate}
            disabled={shouldDisableForm}
            onChange={this.onSpreadsheetTemplateChange}
          />
        </FormGroup>
        <FormGroup>
          <FormLabel htmlFor="jr-setup-edit-gdrive-doc-template">
            Document template doc id
          </FormLabel>
          <FormControl
            id="jr-setup-edit-gdrive-doc-template"
            type="text"
            value={this.state.docTemplate}
            disabled={shouldDisableForm}
            onChange={this.onDocTemplateChange}
          />
        </FormGroup>
        <Button variant="primary" onClick={this.saveTemplates} disabled={shouldDisableForm}>Save</Button>
      </div>
    );
  }
}

interface GoogleIntegrationSectionProps {
  oauthSettings: any;
  gdriveCredential: any;
  docTemplate?: string;
  spreadsheetTemplate?: string;
  enabled: boolean;
}

class GoogleIntegrationSection extends React.Component<GoogleIntegrationSectionProps> {
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
    const compBadgeVariant = stepsDone === 3 ? 'success' : 'warning';
    const oauthBadgeLabel = this.props.oauthSettings ? 'configured' : 'unconfigured';
    const oauthBadgeVariant = this.props.oauthSettings ? 'success' : 'warning';
    const driveBadgeLabel = this.props.gdriveCredential ? 'configured' : 'unconfigured';
    const driveBadgeVariant = this.props.gdriveCredential ? 'success' : 'warning';
    const maybeDriveUserEmail = this.props.gdriveCredential && this.props.gdriveCredential.value && this.props.gdriveCredential.value.email;
    const templateBadgeLabel = this.props.spreadsheetTemplate ? 'configured' : 'unconfigured';
    const templateBadgeVariant = this.props.spreadsheetTemplate ? 'success' : 'warning';

    return (
      <section>
        <h1 className="setup-section-header">
          <span className="setup-section-header-label">
            Google integration
          </span>
          <Badge variant={compBadgeVariant}>
            {comp}
          </Badge>
          <span className="setup-section-header-buttons">
            <Button variant="light" disabled={this.props.enabled} onClick={this.onToggleEnabled}>
              {firstButtonLabel}
            </Button>
            <Button variant="light" disabled={!this.props.enabled} onClick={this.onToggleEnabled}>
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

        <div className="setup-subsection">
          <h2 className="setup-subsection-header">
            <span>OAuth client</span>
            {' '}
            <Badge variant={oauthBadgeVariant}>{oauthBadgeLabel}</Badge>
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

        <div className="setup-subsection">
          <h2 className="setup-subsection-header">
            <span>Drive user</span>
            {' '}
            <Badge variant={driveBadgeVariant}>{driveBadgeLabel}</Badge>
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

        <div className="setup-subsection">
          <h2 className="setup-subsection-header">
            <span>Document templates</span>
            {' '}
            <Badge variant={templateBadgeVariant}>{templateBadgeLabel}</Badge>
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

interface DiscordOAuthFormProps {
  configured: boolean;
  enabled: boolean;
  oauthSettings: any;
}

interface DiscordOAuthFormState {
  clientId: string;
  clientSecret: string;
  submitState: SubmitState.IDLE | SubmitState.SUBMITTING | SubmitState.SUCCESS | SubmitState.ERROR;
  submitError: string;
}

class DiscordOAuthForm extends React.Component<DiscordOAuthFormProps, DiscordOAuthFormState> {
  constructor(props: DiscordOAuthFormProps) {
    super(props);
    this.state = {
      clientId: (props.oauthSettings && props.oauthSettings.appId) || '',
      clientSecret: (props.oauthSettings && props.oauthSettings.secret) || '',
      submitState: SubmitState.IDLE,
      submitError: '',
    };
  }

  dismissAlert = () => {
    this.setState({
      submitState: SubmitState.IDLE,
    });
  };

  onClientIdChange: FormControlProps['onChange'] = (e) => {
    this.setState({
      clientId: e.currentTarget.value,
    });
  };

  onClientSecretChange: FormControlProps['onChange'] = (e) => {
    this.setState({
      clientSecret: e.currentTarget.value,
    });
  };

  onSubmitOauthConfiguration = (e: React.FormEvent<any>) => {
    e.preventDefault();

    const clientId = this.state.clientId.trim();
    const clientSecret = this.state.clientSecret.trim();

    if (clientId.length > 0 && clientSecret.length === 0) {
      this.setState({
        submitState: SubmitState.ERROR,
        submitError: 'You appear to be clearing the secret but not the client ID.  Please provide a secret.',
      } as DiscordOAuthFormState);
    } else {
      this.setState({
        submitState: SubmitState.SUBMITTING,
      });
      Meteor.call('setupDiscordOAuthClient', clientId, clientSecret, (err?: Error) => {
        if (err) {
          this.setState({
            submitState: SubmitState.ERROR,
            submitError: err.message,
          } as DiscordOAuthFormState);
        } else {
          this.setState({
            submitState: SubmitState.SUCCESS,
          });
        }
      });
    }
  };

  render() {
    const shouldDisableForm = this.state.submitState === 'submitting';
    const configured = !!this.props.oauthSettings;
    const secretPlaceholder = configured ? '<configured secret not revealed>' : '';
    return (
      <div>
        {this.state.submitState === 'submitting' ? <Alert variant="info">Saving...</Alert> : null}
        {this.state.submitState === 'success' ? <Alert variant="success" dismissible onClose={this.dismissAlert}>Saved changes.</Alert> : null}
        {this.state.submitState === 'error' ? (
          <Alert variant="danger" dismissible onClose={this.dismissAlert}>
            Saving failed:
            {' '}
            {this.state.submitError}
          </Alert>
        ) : null}

        {/* TODO: UI for client ID and client secret */}
        <form onSubmit={this.onSubmitOauthConfiguration}>
          <FormGroup>
            <FormLabel htmlFor="jr-setup-edit-discord-client-id">
              Client ID
            </FormLabel>
            <FormControl
              id="jr-setup-edit-discord-client-id"
              type="text"
              placeholder=""
              value={this.state.clientId}
              disabled={shouldDisableForm}
              onChange={this.onClientIdChange}
            />
          </FormGroup>
          <FormGroup>
            <FormLabel htmlFor="jr-setup-edit-discord-client-secret">
              Client Secret
            </FormLabel>
            <FormControl
              id="jr-setup-edit-discord-client-secret"
              type="text"
              placeholder={secretPlaceholder}
              value={this.state.clientSecret}
              disabled={shouldDisableForm}
              onChange={this.onClientSecretChange}
            />
          </FormGroup>
          <Button variant="primary" type="submit" onClick={this.onSubmitOauthConfiguration} disabled={shouldDisableForm}>Save</Button>
        </form>
      </div>
    );
  }
}

interface DiscordBotFormProps {
  botToken?: string
}

interface DiscordBotFormState {
  botToken: string;
  submitState: SubmitState.IDLE | SubmitState.SUBMITTING | SubmitState.SUCCESS | SubmitState.ERROR;
  submitError: string;
}

class DiscordBotForm extends React.Component<DiscordBotFormProps, DiscordBotFormState> {
  constructor(props: DiscordBotFormProps) {
    super(props);
    this.state = {
      botToken: props.botToken || '',
      submitState: SubmitState.IDLE,
      submitError: '',
    };
  }

  dismissAlert = () => {
    this.setState({
      submitState: SubmitState.IDLE,
    });
  };

  onBotTokenChange: FormControlProps['onChange'] = (e) => {
    this.setState({
      botToken: e.currentTarget.value,
    });
  };

  onSubmitBotToken = (e: React.FormEvent<any>) => {
    e.preventDefault();

    const botToken = this.state.botToken.trim();

    this.setState({
      submitState: SubmitState.SUBMITTING,
    });
    Meteor.call('setupDiscordBotToken', botToken, (err?: Error) => {
      if (err) {
        this.setState({
          submitState: SubmitState.ERROR,
          submitError: err.message,
        });
      } else {
        this.setState({
          submitState: SubmitState.SUCCESS,
        });
      }
    });
  };

  render() {
    const shouldDisableForm = this.state.submitState === SubmitState.SUBMITTING;
    return (
      <div>
        {this.state.submitState === 'submitting' ? <Alert variant="info">Saving...</Alert> : null}
        {this.state.submitState === 'success' ? <Alert variant="success" dismissible onClose={this.dismissAlert}>Saved changes.</Alert> : null}
        {this.state.submitState === 'error' ? (
          <Alert variant="danger" dismissible onClose={this.dismissAlert}>
            Saving failed:
            {' '}
            {this.state.submitError}
          </Alert>
        ) : null}

        <form onSubmit={this.onSubmitBotToken}>
          <FormGroup>
            <FormLabel htmlFor="jr-setup-edit-discord-bot-token">
              Bot token
            </FormLabel>
            <FormControl
              id="jr-setup-edit-discord-bot-token"
              type="text"
              placeholder=""
              value={this.state.botToken}
              disabled={shouldDisableForm}
              onChange={this.onBotTokenChange}
            />
          </FormGroup>
          <Button variant="primary" type="submit" onClick={this.onSubmitBotToken} disabled={shouldDisableForm}>Save</Button>
        </form>
      </div>
    );
  }
}

interface DiscordGuildFormContainerProps {
  // initial value from settings
  guild?: DiscordGuildType;
}

interface DiscordGuildFormProps extends DiscordGuildFormContainerProps {
  ready: boolean;
  // List of possible guilds from server
  guilds: DiscordGuildType[];
}

interface DiscordGuildFormState {
  guildId: string;
  submitState: SubmitState.IDLE | SubmitState.SUBMITTING | SubmitState.SUCCESS | SubmitState.ERROR;
  submitError: string;
}

class DiscordGuildForm extends React.Component<DiscordGuildFormProps, DiscordGuildFormState> {
  constructor(props: DiscordGuildFormProps) {
    super(props);
    this.state = {
      guildId: (props.guild && props.guild._id) || '',
      submitState: SubmitState.IDLE,
      submitError: '',
    };
  }

  dismissAlert = () => {
    this.setState({
      submitState: SubmitState.IDLE,
    });
  };

  onSelectedGuildChange: FormControlProps['onChange'] = (e) => {
    const newValue = e.currentTarget.value === 'empty' ? '' : e.currentTarget.value;
    this.setState({
      guildId: newValue,
    });
  };

  onSaveGuild = (e: React.FormEvent<any>) => {
    e.preventDefault();

    const guild = this.props.guilds.find((g) => g._id === this.state.guildId);
    this.setState({
      submitState: SubmitState.SUBMITTING,
    });
    Meteor.call('setupDiscordBotGuild', guild, (err?: Error) => {
      if (err) {
        this.setState({
          submitState: SubmitState.ERROR,
          submitError: err.message,
        });
      } else {
        this.setState({
          submitState: SubmitState.SUCCESS,
        });
      }
    });
  };

  render() {
    const shouldDisableForm = this.state.submitState === SubmitState.SUBMITTING;
    const noneOption = {
      _id: 'empty',
      name: 'No guild assigned',
    };
    const formOptions = [noneOption, ...this.props.guilds];
    return (
      <div>
        {this.state.submitState === 'submitting' ? <Alert variant="info">Saving...</Alert> : null}
        {this.state.submitState === 'success' ? <Alert variant="success" dismissible onClose={this.dismissAlert}>Saved changes.</Alert> : null}
        {this.state.submitState === 'error' ? (
          <Alert variant="danger" dismissible onClose={this.dismissAlert}>
            Saving failed:
            {' '}
            {this.state.submitError}
          </Alert>
        ) : null}

        <form onSubmit={this.onSaveGuild}>
          <FormGroup>
            <FormLabel htmlFor="jr-setup-edit-discord-bot-guild">
              Bot token
            </FormLabel>
            <FormControl
              id="jr-setup-edit-discord-bot-guild"
              as="select"
              type="text"
              placeholder=""
              value={this.state.guildId}
              disabled={shouldDisableForm}
              onChange={this.onSelectedGuildChange}
            >
              {formOptions.map(({ _id, name }) => {
                return (
                  <option key={_id} value={_id}>{name}</option>
                );
              })}
            </FormControl>
          </FormGroup>
          <Button variant="primary" type="submit" onClick={this.onSaveGuild} disabled={shouldDisableForm}>Save</Button>
        </form>
      </div>
    );
  }
}

const DiscordGuildFormContainer = withTracker((_props: DiscordGuildFormContainerProps) => {
  // DiscordGuilds is a pseudocollection, and the subscribe here causes the
  // server to do a call against the Discord API to list guilds the user is in.
  // It's not reactive; you might have to refresh the page to get it to update.
  // Didn't seem worth making cleverer; this will get used ~once.
  const guildSub = Meteor.subscribe('discord.guilds');
  const ready = guildSub.ready();
  const guilds = ready ? DiscordGuilds.find({}).fetch() : [];
  return {
    ready: false,
    guilds,
  };
})(DiscordGuildForm);

interface DiscordIntegrationSectionProps {
  configured: boolean;
  enabled: boolean;
  oauthSettings?: Configuration;
  botToken?: string;
  guild?: DiscordGuildType;
}

class DiscordIntegrationSection extends React.Component<DiscordIntegrationSectionProps> {
  onToggleEnabled = () => {
    const newValue = !this.props.enabled;
    const ffValue = newValue ? 'off' : 'on';
    Meteor.call('setFeatureFlag', 'disable.discord', ffValue);
  };

  render() {
    const firstButtonLabel = this.props.enabled ? 'Enabled' : 'Enable';
    const secondButtonLabel = this.props.enabled ? 'Disable' : 'Disabled';

    const configured = !!this.props.oauthSettings;
    const headerBadgeVariant = configured ? 'success' : 'warning';
    const clientId = this.props.oauthSettings && this.props.oauthSettings.appId;
    const addGuildLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=8`;
    const oauthBadgeLabel = this.props.oauthSettings ? 'configured' : 'unconfigured';
    const oauthBadgeVariant = this.props.oauthSettings ? 'success' : 'warning';
    const botBadgeLabel = this.props.botToken ? 'configured' : 'unconfigured';
    const botBadgeVariant = this.props.botToken ? 'success' : 'warning';
    const guildBadgeLabel = this.props.guild ? 'configured' : 'unconfigured';
    const guildBadgeVariant = this.props.guild ? 'success' : 'warning';
    return (
      <section>
        <h1 className="setup-section-header">
          <span className="setup-section-header-label">
            Discord integration
          </span>
          <Badge variant={headerBadgeVariant}>
            {configured ? 'Configured' : 'Unconfigured'}
          </Badge>
          {configured && (
          <span className="setup-section-header-buttons">
            <Button variant="light" disabled={this.props.enabled} onClick={this.onToggleEnabled}>
              {firstButtonLabel}
            </Button>
            <Button variant="light" disabled={!this.props.enabled} onClick={this.onToggleEnabled}>
              {secondButtonLabel}
            </Button>
          </span>
          )}
        </h1>

        <p>
          Jolly Roger supports a Discord integration, where this instance
          connects to Discord as a bot user with several useful capabilities.
        </p>
        <ul>
          <li>(TODO): It can invite users to a guild (&quot;server&quot;) that it is a member of</li>
          <li>(TODO): It can send messages to a channel on new puzzle creation, or when a puzzle is solved</li>
          <li>(TODO): It can send messages to a channel when a new announcement is created</li>
          <li>(TODO): It can send messages to a channel when users write chat messages on puzzle pages</li>
        </ul>
        <p>
          There are multiple pieces to Jolly Roger&apos;s Discord integration capabilities:
        </p>
        <ol>
          <li>
            The OAuth client, which allows Jolly Roger to have users link
            their Discord account to their Jolly Roger account.  This enables
            Jolly Roger to correlate chat messages sent on Discord with user
            accounts within Jolly Roger.
          </li>
          <li>
            The bot account, which allows Jolly Roger to programmatically
            manage guild (&quot;server&quot;) invitations to members.
          </li>
          <li>
            Guild selection, since Discord bots can be part of multiple guilds.
          </li>
        </ol>

        <div className="setup-subsection">
          <h2 className="setup-subsection-header">
            <span>OAuth client</span>
            {' '}
            <Badge variant={oauthBadgeVariant}>{oauthBadgeLabel}</Badge>
          </h2>
          <p>
            Jolly Roger can allow Discord users to grant limited access to
            their Discord account for the purposes of adding them to a guild
            and linking their chat messages between the two services.
          </p>
          <p>
            To enable Discord OAuth integration, you will need to:
          </p>
          <ol>
            <li>Create a new Discord application at <a href="https://discord.com/developers/applications">https://discord.com/developers/applications</a></li>
            <li>In the OAuth2 section, add a redirect pointing to <span>{Meteor.absoluteUrl('/_oauth/discord')}</span></li>
            <li>In the Bot section, create a bot account.</li>
            <li>Copy the Client ID and Client Secret from the &quot;General Information&quot; section and paste them here below.</li>
            <li>Copy the Token from the Bot section and paste it below.</li>
            <li>Click the save button below.</li>
            <li>Then, after you have successfully saved the client secret and bot token: as the guild (&quot;server&quot;) owner, <a href={addGuildLink}>add the bot to your Discord guild here</a>.</li>
          </ol>
          <DiscordOAuthForm
            configured={this.props.configured}
            enabled={this.props.enabled}
            oauthSettings={this.props.oauthSettings}
          />
        </div>

        <div className="setup-subsection">
          <h2 className="setup-subsection-header">
            <span>Bot account</span>
            {' '}
            <Badge variant={botBadgeVariant}>{botBadgeLabel}</Badge>
          </h2>
          <p>
            Since Discord only allows guild invitations to be managed by bot
            accounts, to use Jolly Roger to automate Discord guild membership,
            you must create a bot account, save its token here, and then add
            it to the guild for which you wish to automate invites.
          </p>
          <DiscordBotForm
            botToken={this.props.botToken}
          />
        </div>

        <div className="setup-subsection">
          <h2 className="setup-subsection-header">
            <span>Guild</span>
            {' '}
            <Badge variant={guildBadgeVariant}>{guildBadgeLabel}</Badge>
          </h2>
          <p>
            Since bots can be part of multiple guilds, you&apos;ll need to specify
            which one you want Jolly Roger to add users to.  Note that Discord
            bots can only add other users to guilds which they are already a
            member of, so if you see no guilds selectable here, you may need
            to first <a href={addGuildLink}>add the bot to your guild</a>.
          </p>

          <DiscordGuildFormContainer
            guild={this.props.guild}
          />
        </div>
      </section>
    );
  }
}

interface WebRTCServersFormProps {
  turnServerUrls: string[];
}

interface WebRTCServersFormState {
  url: string;
  submitState: SubmitState.IDLE | SubmitState.SUBMITTING | SubmitState.SUCCESS | SubmitState.ERROR;
  submitError: string;
}

class WebRTCServersForm extends React.Component<WebRTCServersFormProps, WebRTCServersFormState> {
  constructor(props: WebRTCServersFormProps) {
    super(props);
    this.state = {
      url: props.turnServerUrls.length > 0 ? props.turnServerUrls[0] : '',
      submitState: SubmitState.IDLE,
      submitError: '',
    };
  }

  dismissAlert = () => {
    this.setState({
      submitState: SubmitState.IDLE,
    });
  };

  onUrlChange: FormControlProps['onChange'] = (e) => {
    this.setState({
      url: e.currentTarget.value,
    });
  };

  onSubmit = (e: React.FormEvent<any>) => {
    e.preventDefault();

    const url = this.state.url.trim();

    this.setState({
      submitState: SubmitState.SUBMITTING,
    });
    Meteor.call('setupTurnServerUrls', [url], (err?: Error) => {
      if (err) {
        this.setState({
          submitState: SubmitState.ERROR,
          submitError: err.message,
        });
      } else {
        this.setState({
          submitState: SubmitState.SUCCESS,
        });
      }
    });
  };

  render() {
    const shouldDisableForm = this.state.submitState === SubmitState.SUBMITTING;
    return (
      <div>
        {this.state.submitState === 'submitting' ? <Alert variant="info">Saving...</Alert> : null}
        {this.state.submitState === 'success' ? <Alert variant="success" dismissible onClose={this.dismissAlert}>Saved changes.</Alert> : null}
        {this.state.submitState === 'error' ? (
          <Alert variant="danger" dismissible onClose={this.dismissAlert}>
            Saving failed:
            {' '}
            {this.state.submitError}
          </Alert>
        ) : null}

        <form onSubmit={this.onSubmit}>
          <FormGroup>
            <FormLabel htmlFor="jr-setup-edit-webrtc-turn-server-url">
              Turn server URL
            </FormLabel>
            <FormControl
              id="jr-setup-edit-webrtc-turn-server-url"
              type="text"
              placeholder=""
              value={this.state.url}
              disabled={shouldDisableForm}
              onChange={this.onUrlChange}
            />
          </FormGroup>
          <Button variant="primary" type="submit" onClick={this.onSubmit} disabled={shouldDisableForm}>Save</Button>
        </form>
      </div>
    );
  }
}

interface WebRTCSectionProps {
  turnServerUrls: string[];
}

class WebRTCSection extends React.Component<WebRTCSectionProps> {
  render() {
    return (
      <section>
        <h1 className="setup-section-header">
          <span className="setup-section-header-label">
            WebRTC
          </span>
        </h1>
        <WebRTCServersForm turnServerUrls={this.props.turnServerUrls} />
      </section>
    );
  }
}

interface CircuitBreakerControlProps {
  // disabled should be false if the circuit breaker is not intentionally disabling the feature,
  // and true if the feature is currently disabled.
  // most features will have false here most of the time.
  featureDisabled: boolean;

  // What do you call this circuit breaker?
  title: string;

  // some explanation of what this feature flag controls and why you might want to toggle it.
  children: React.ReactNode;

  // callback to call when the user requests changing this flag's state
  onChange: (desiredState: boolean) => void;
}

class CircuitBreakerControl extends React.Component<CircuitBreakerControlProps> {
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
            <Button variant="light" disabled={featureIsEnabled} onClick={this.onChange}>
              {firstButtonLabel}
            </Button>
            <Button variant="light" disabled={!featureIsEnabled} onClick={this.onChange}>
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

interface CircuitBreakerSectionProps {
  flagDisableGdrivePermissions: boolean;
  flagDisableApplause: boolean;
  flagDisableWebrtc: boolean;
}

class CircuitBreakerSection extends React.Component<CircuitBreakerSectionProps> {
  setFlagValue(flag: string, value: boolean) {
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
          onChange={(newValue) => this.setFlagValue('disable.gdrive_permissions', newValue)}
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
          title="Celebrations"
          featureDisabled={this.props.flagDisableApplause}
          onChange={(newValue) => this.setFlagValue('disable.applause', newValue)}
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
        <CircuitBreakerControl
          title="WebRTC calls"
          featureDisabled={this.props.flagDisableWebrtc}
          onChange={(newValue) => this.setFlagValue('disable.webrtc', newValue)}
        >
          <p>
            Jolly Roger has experimental support for making WebRTC audio calls
            built into each puzzle page.  Jolly Roger provides the signaling
            server and all members of the call establish a direct connection to
            all other members of the same call (which is more complex at the
            edge, but avoids needing to operate a separate high-capacity,
            latency-sensitive reencoding server).  Note that video calls are
            not currently supported primarily due to the bandwidth constraints
            the mesh connectivity would imply -- video consumes 60x the bitrate
            of audio, and we estimate most residential network connections to
            only be able to reliably support around 4 call participants at a
            time before significant degradation.
          </p>
          <p>
            Disabling this feature means that Jolly Roger will not show an
            audiocall section in the UI on the puzzle page, nor will clients
            join calls.  The server will still service WebRTC-related
            subscriptions and methods, but we expect clients to not generate
            such load once the flag is flipped.
          </p>
        </CircuitBreakerControl>
      </section>
    );
  }
}

interface SetupPageRewriteProps {
  ready: boolean;

  canConfigure: boolean;

  googleConfig: any;
  gdriveCredential: any;
  docTemplate?: string;
  spreadsheetTemplate?: string;

  discordOAuthConfig?: Configuration;
  flagDisableDiscord: boolean;
  discordBotToken?: string;
  discordGuild?: DiscordGuildType;

  turnServerUrls: string[];

  flagDisableGoogleIntegration: boolean;
  flagDisableGdrivePermissions: boolean;
  flagDisableApplause: boolean;
  flagDisableWebrtc: boolean;
}

class SetupPageRewrite extends React.Component<SetupPageRewriteProps> {
  render() {
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

    const discordConfigured = !!this.props.discordOAuthConfig;
    const discordEnabled = !this.props.flagDisableDiscord;
    return (
      <div className="setup-page">
        <GoogleIntegrationSection
          oauthSettings={this.props.googleConfig}
          enabled={!this.props.flagDisableGoogleIntegration}
          gdriveCredential={this.props.gdriveCredential}
          docTemplate={this.props.docTemplate}
          spreadsheetTemplate={this.props.spreadsheetTemplate}
        />
        <DiscordIntegrationSection
          oauthSettings={this.props.discordOAuthConfig}
          configured={discordConfigured}
          enabled={discordEnabled}
          botToken={this.props.discordBotToken}
          guild={this.props.discordGuild}
        />
        <WebRTCSection
          turnServerUrls={this.props.turnServerUrls}
        />
        <CircuitBreakerSection
          flagDisableGdrivePermissions={this.props.flagDisableGdrivePermissions}
          flagDisableApplause={this.props.flagDisableApplause}
          flagDisableWebrtc={this.props.flagDisableWebrtc}
        />
      </div>
    );
  }
}

const crumb = withBreadcrumb({ title: 'Server setup', path: '/setup' });
const tracker = withTracker((): SetupPageRewriteProps => {
  const canConfigure = Roles.userHasRole(Meteor.userId()!, 'admin');

  // We need to fetch the contents of the Settings table
  const settingsHandle = Meteor.subscribe('mongo.settings');

  // Google
  const googleConfig = ServiceConfiguration.configurations.findOne({ service: 'google' });
  const gdriveCredential = Settings.findOne({ name: 'gdrive.credential' });
  const docTemplate = Settings.findOne({ name: 'gdrive.template.document' });
  const docTemplateId = docTemplate && docTemplate.name === 'gdrive.template.document' ?
    docTemplate.value.id : undefined;
  const spreadsheetTemplate = Settings.findOne({ name: 'gdrive.template.spreadsheet' });
  const spreadsheetTemplateId = spreadsheetTemplate && spreadsheetTemplate.name === 'gdrive.template.spreadsheet' ?
    spreadsheetTemplate.value.id : undefined;

  // Discord
  const discordOAuthConfig = ServiceConfiguration.configurations.findOne({ service: 'discord' });
  const flagDisableDiscord = Flags.active('disable.discord');
  const discordBotTokenDoc = Settings.findOne({ name: 'discord.bot' });
  const discordBotToken = discordBotTokenDoc && discordBotTokenDoc.name === 'discord.bot' ? discordBotTokenDoc.value.token : undefined;
  const discordGuildDoc = Settings.findOne({ name: 'discord.guild' });
  const discordGuild = discordGuildDoc && discordGuildDoc.name === 'discord.guild' ? discordGuildDoc.value.guild : undefined;

  // WebRTC
  const turnServerConfig = PublicSettings.findOne({ name: 'webrtc.turnserver' });
  const turnServerUrls = (turnServerConfig && turnServerConfig.name === 'webrtc.turnserver' && turnServerConfig.value.urls) || [];

  // Circuit breakers
  const flagDisableGoogleIntegration = Flags.active('disable.google');
  const flagDisableGdrivePermissions = Flags.active('disable.gdrive_permissions');
  const flagDisableApplause = Flags.active('disable.applause');
  const flagDisableWebrtc = Flags.active('disable.webrtc');

  return {
    ready: settingsHandle.ready(),

    canConfigure,

    googleConfig,
    gdriveCredential,
    docTemplate: docTemplateId,
    spreadsheetTemplate: spreadsheetTemplateId,

    discordOAuthConfig,
    flagDisableDiscord,
    discordBotToken,
    discordGuild,

    turnServerUrls,

    flagDisableGoogleIntegration,
    flagDisableGdrivePermissions,
    flagDisableApplause,
    flagDisableWebrtc,
  };
});

export default crumb(tracker(SetupPageRewrite));
