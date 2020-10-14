import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import React from 'react';
import FormControl from 'react-bootstrap/FormControl';
import FormGroup from 'react-bootstrap/FormGroup';
import FormLabel from 'react-bootstrap/FormLabel';
import CallSignals from '../../lib/models/call_signals';
import { CallParticipantType } from '../../lib/schemas/call_participants';
import { CallSignalType, CallSignalMessageType } from '../../lib/schemas/call_signals';

const enableExpensiveFeatures = true;

// props:
//   selfParticipant: CallParticipantType
//   peerParticipant: CallParticipantType
//
// meteor data props:
//   candidates
//   signaling?
//
// state:
//   connection state?
//
// new
// awaiting-inbound-offer
// responding

interface CallLinkParams {
  selfParticipant: CallParticipantType;
  peerParticipant: CallParticipantType;
  stream: MediaStream;
  audioContext: AudioContext;
}

interface CallLinkProps extends CallLinkParams {
  signal: CallSignalType | undefined;
}

interface CallLinkState {
  localCandidates: RTCIceCandidate[];
  volumeLevel: number;
}

const rtcConfig = {
  iceServers: [
    // TODO: implement TURN relaying if necessary.
    // For what it's worth: all the setups I've tried so far have worked
    // without a TURN setup, but it's probably still worth investing in making
    // it work for the long tail of network configurations.
    // { urls: "turn:turn.zarvox.org:3478?transport=udp" },
    { urls: ['stun:turn.zarvox.org'] },
  ],
};

/*
const offerOptions = {
  offerToReceiveVideo: 1,
};
*/

class CallLink extends React.Component<CallLinkProps, CallLinkState> {
  private videoRef: React.RefObject<HTMLVideoElement>;

  private canvasRef: React.RefObject<HTMLCanvasElement>;

  private remoteStream: MediaStream;

  private pc: RTCPeerConnection;

  private isInitiator: boolean;

  private wrapperStreamSource: MediaStreamAudioSourceNode | undefined;

  private wrapperStreamDestination: MediaStreamAudioDestinationNode;

  private gainNode: GainNode;

  private analyserNode: AnalyserNode;

  private bufferLength: number;

  private analyserBuffer: Uint8Array;

  private periodicHandle: number | undefined;

  constructor(props: CallLinkProps) {
    super(props);

    this.state = {
      localCandidates: [],
      volumeLevel: 100,
    };

    // Create a ref so we can get at the video element on the page to set
    // the srcObject.
    this.videoRef = React.createRef();
    this.canvasRef = React.createRef();

    // Create a stream object to populate tracks into as we receive them
    // from our peer.
    this.remoteStream = new MediaStream();
    this.gainNode = this.props.audioContext.createGain();
    this.wrapperStreamDestination = this.props.audioContext.createMediaStreamDestination();

    // For showing spectrogram
    this.analyserNode = this.props.audioContext.createAnalyser();
    this.analyserNode.fftSize = 128;
    this.bufferLength = this.analyserNode.frequencyBinCount;
    this.analyserBuffer = new Uint8Array(this.bufferLength);

    this.pc = new RTCPeerConnection(rtcConfig);
    this.pc.addEventListener('icecandidate', this.onNewLocalCandidate);
    this.pc.addEventListener('iceconnectionstatechange', this.onIceConnectionStateChange);
    this.pc.addEventListener('connectionstatechange', this.onConnectionStateChange);
    this.pc.addEventListener('track', this.onNewRemoteTrack);
    this.pc.addEventListener('negotiationneeded', this.onNegotiationNeeded);

    this.periodicHandle = undefined;

    // TODO: figure out where these actually come from
    // this.remoteStream.addEventListener("removetrack", this.onRemoveRemoteTrack);

    // Add stream to RTCPeerConnection for self.
    const tracks = props.stream.getTracks();
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      this.log(track, props.stream);
      this.pc.addTrack(track);
    }

    // If we're the initiator, get the ball rolling.  Create an
    // offer, so we'll:
    // 1) generate an SDP descriptor and
    // 2) start doing STUN to collect our ICE candidates.
    //
    // We must make the offer *after* we have a user media stream;
    // browsers won't bother if the peer doesn't have a stream worth
    // sharing, because SDP requires knowing what the stream format
    // is.  (This is fine; we already have the stream by the time we
    // construct a CallLink.)
    this.isInitiator = props.selfParticipant._id < props.peerParticipant._id;
    if (this.isInitiator) {
      this.pc.createOffer().then(this.onLocalOfferCreated);
    }

    if (props.signal) {
      this.log(`signals: processing ${props.signal.messages.length} initial signals`);
      this.processSignalMessages(props.signal.messages, 0);
    }
  }

  componentDidUpdate(prevProps: CallLinkProps, _prevState: CallLinkState, _snapshot: any) {
    // Process any new signal messages in the updated props.
    if (this.props.signal) {
      const newLength = this.props.signal.messages.length;
      const oldLength = prevProps.signal ? prevProps.signal.messages.length : 0;
      this.log(`signals: old ${oldLength} new ${newLength}`);
      this.processSignalMessages(this.props.signal.messages, oldLength);
    }
  }

  componentWillUnmount() {
    // Tear down the connections and all active streams on them.
    this.pc.close();

    if (this.periodicHandle) {
      window.cancelAnimationFrame(this.periodicHandle);
      this.periodicHandle = undefined;
    }
  }

  // Convenience function to log the peer participant ID along with whatever
  // you wanted to see, so you can see just the logs from whatever participant
  // isn't connecting.
  log = (...args: any) => {
    // eslint-disable-next-line no-console
    console.log(this.props.peerParticipant._id, ...args);
  }

  onLocalOfferCreated = (offer: RTCSessionDescriptionInit) => {
    this.log('onLocalOfferCreated');
    this.log(offer);
    this.pc.setLocalDescription(offer);
    const offerObj = {
      type: offer.type,
      sdp: offer.sdp,
    };
    Meteor.call('signalPeer', this.props.selfParticipant._id, this.props.peerParticipant._id, { type: 'sdp', content: JSON.stringify(offerObj) });
  };

  processSignalMessages = (messages: CallSignalMessageType[], previouslyProcessed: number) => {
    const len = messages.length;
    for (let i = previouslyProcessed; i < len; i++) {
      // this.log(`signal ${i}: ${JSON.stringify(this.props.signal.messages[i])}`);
      this.handleSignal(messages[i]);
    }
  };

  handleSignal = (message: CallSignalMessageType) => {
    if (message.type === 'sdp') {
      this.log('handle sdp');
      // Create an RTCSessionDescription using the received SDP offer.
      // Set it.  In the callback, create an answer, then set that as
      // the local description, then signal the initiator.
      const sdpDesc = JSON.parse(message.content);
      this.pc.setRemoteDescription(sdpDesc)
        .then(this.onRemoteDescriptionSet)
        .catch(this.onRemoteDescriptionSetFailure);
    } else if (message.type === 'iceCandidate') {
      this.log('handle ice', message.content);
      const iceDesc = JSON.parse(message.content);
      if (iceDesc) {
        const remoteCandidate = new RTCIceCandidate(iceDesc);
        // TODO: error handling
        this.pc.addIceCandidate(remoteCandidate);
      } else {
        this.log('all candidates received');
      }
    } else {
      this.log('dunno what this message is:', message);
    }
  };

  onAnswerCreated = (answer: RTCSessionDescriptionInit) => {
    this.log('onAnswerCreated', answer);
    this.pc.setLocalDescription(answer);
    const answerObj = {
      type: answer.type,
      sdp: answer.sdp,
    };
    Meteor.call('signalPeer', this.props.selfParticipant._id, this.props.peerParticipant._id, { type: 'sdp', content: JSON.stringify(answerObj) });
  };

  onAnswerCreatedFailure = (err: DOMException) => {
    this.log('onAnswerCreatedFailure', err);
  }

  onRemoteDescriptionSet = () => {
    this.log('remoteDescriptionSet');
    if (!this.isInitiator) {
      this.pc.createAnswer().then(this.onAnswerCreated);
    }
  };

  onRemoteDescriptionSetFailure = (err: Error) => {
    this.log('remoteDescriptionSetFailure', err);
  };

  onNewLocalCandidate = (e: RTCPeerConnectionIceEvent) => {
    //    this.log("new local candidate:");
    //    this.log(e);
    const iceCandidate = e.candidate;
    if (iceCandidate) {
      this.setState((prevState) => {
        return { localCandidates: [...prevState.localCandidates, iceCandidate] };
      });
    } else {
      this.log('local candidate list complete');
    }

    Meteor.call('signalPeer',
      this.props.selfParticipant._id,
      this.props.peerParticipant._id,
      { type: 'iceCandidate', content: JSON.stringify(iceCandidate) });
  };

  onNewRemoteTrack = (e: RTCTrackEvent) => {
    this.log('newRemoteTrack', e);
    if (e.track.kind === 'audio') {
      // Wire in the gain node, through the audio context.
      const stubStream = new MediaStream();
      stubStream.addTrack(e.track);

      // This audio element is a workaround for
      // https://bugs.chromium.org/p/chromium/issues/detail?id=933677 wherein
      // audio tracks from a peer connection never deliver data into a WebAudio
      // context unless they are first made the srcObject of some audio or
      // video element.
      const stubAudioElement = document.createElement('audio');
      stubAudioElement.muted = true;
      stubAudioElement.srcObject = stubStream;

      this.wrapperStreamSource = this.props.audioContext.createMediaStreamSource(stubStream);

      // Wire up the audio track to the gain node.
      this.wrapperStreamSource.connect(this.gainNode);

      // Then wire up the output of that gain node to our levels-adjusted track.
      this.gainNode.connect(this.wrapperStreamDestination);
      const innerTracks = this.wrapperStreamDestination.stream.getTracks();
      this.log('innerTracks', innerTracks);
      const leveledAudioTrack = innerTracks[0];

      // Add that track to our post-level-adjustment stream.
      this.remoteStream.addTrack(leveledAudioTrack);

      if (enableExpensiveFeatures) {
        // Wire up the audio track to the analyser.
        this.wrapperStreamSource.connect(this.analyserNode);

        // Enable periodic updates of the frequency analyzer
        this.periodicHandle = window.requestAnimationFrame(this.drawSpectrum);
      }
    } else {
      this.remoteStream.addTrack(e.track);
    }

    if (this.videoRef.current) {
      this.videoRef.current.srcObject = this.remoteStream;
    }
  };

  drawSpectrum = (_time: number) => {
    // _time is msecs
    this.periodicHandle = window.requestAnimationFrame(this.drawSpectrum);
    this.analyserNode.getByteFrequencyData(this.analyserBuffer);
    const canvas = this.canvasRef.current;
    if (canvas) {
      canvas.setAttribute('width', '200');
      canvas.setAttribute('height', '80');

      const canvasCtx = canvas.getContext('2d');
      if (canvasCtx) {
        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;
        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
        canvasCtx.fillStyle = 'rgb(0, 0, 0)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
        const barWidth = (WIDTH / this.bufferLength);
        let barHeight;
        let x = 0;
        for (let i = 0; i < this.bufferLength; i++) {
          barHeight = (this.analyserBuffer[i] * HEIGHT) / 255;
          const greenness = this.analyserBuffer[i] + 100 > 255 ? 255 : this.analyserBuffer[i] + 100;
          canvasCtx.fillStyle = `rgb(50,${greenness},50)`;
          canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }
    }
  };

  onNegotiationNeeded = (e: Event) => {
    this.log('negotiationNeeded', e);
  };

  /*
  onRemoveRemoteTrack = (e: Event) => {
    this.log("removeRemoteTrack", e);
  };
  */

  onIceConnectionStateChange = (e: Event) => {
    this.log('new ice connection state change:');
    this.log(e);
    // Repaint.
    this.forceUpdate();
  };

  onConnectionStateChange = (e: Event) => {
    this.log('new connection state change:');
    this.log(e);
    // Repaint.
    this.forceUpdate();
  };

  onButtonClick = () => {
    this.forceUpdate();
  };

  onVolumeControlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volumeLevel = Number(e.target.value);
    this.setState({
      volumeLevel,
    });
    this.gainNode.gain.setValueAtTime(volumeLevel / 100, this.props.audioContext.currentTime);
  };

  render() {
    return (
      <div className="call-link">
        <div className="call-link-data">
          <span className="">
            Peer:
            <code>{this.props.peerParticipant._id}</code>
          </span>
          <div className="volume">
            <FormGroup controlId="selfVolume">
              <FormLabel>Volume</FormLabel>
              <FormControl type="range" min="0" max="100" step="1" value={this.state.volumeLevel} onChange={this.onVolumeControlChange} />
            </FormGroup>
          </div>
          {enableExpensiveFeatures ? (
            <div>
              <canvas ref={this.canvasRef} />
            </div>
          ) : null}
          <span className="">
            Role:
            <code>{this.isInitiator ? 'initiator' : 'responder'}</code>
          </span>
          <span className="signalState">
            signal state:
            <code>{this.pc.signalingState}</code>
          </span>
          <span className="state">
            conn state:
            <code>{this.pc.connectionState}</code>
          </span>
          <span className="iceState">
            ICE state:
            <code>{this.pc.iceConnectionState}</code>
          </span>
          <span className="candidates">
            {this.state.localCandidates.length}
            {' '}
            candidates
          </span>
          {/* <button onClick={this.onButtonClick}>update</button> */}
        </div>
        <video ref={this.videoRef} className="call-link-video-sink" autoPlay playsInline />
      </div>
    );
  }
}

const CallLinkContainer = withTracker((props: CallLinkParams) => {
  // WebRTC is not a symmetric protocol like TCP, where both sides can
  // initiate and respond and you'll get a single connection.  For any
  // given link, one side produces an offer, and the other side produces a
  // reply.  To avoid generating extra traffic, we simply declare that
  // the peer with the lower CallParticipant ID is the initiator, and the
  // other peer the responder.

  // Determine if we are expected to be the initiator or the responder
  // for this call.
  // this.log("self:", selfParticipant);
  // this.log("peer:", peerParticipant);

  // Query Mongo for CallSignals that match.
  // CallSignals feels like it could use some work -- maybe
  // make each signal message into an object and then just push them
  // onto an array? and then just use observe on the right doc?
  const sessionQuery = {
    sender: props.peerParticipant._id,
    target: props.selfParticipant._id,
  };

  const signal = CallSignals.findOne(sessionQuery);
  return {
    signal,
  };
})(CallLink);

// const CallLinkContainer = tracker(CallLink);

export default CallLinkContainer;
