import Dockerode from 'dockerode-ts';
const dockerClient = new Dockerode();
import { publisher } from './publisher';
import { DeploymentUpdateEvent } from "../shared/events";
import {ContainerInfo} from "dockerode-ts";

const labelArray = [
  'deployment.name', 'deployment.url', 'deployment.vcs.ref'
];

const eventStreamOptions = {
  filters: {
    type: ['container'],
    event: ['die', 'start'],
    label: labelArray
  }
};

const listOptions = {
  filters: {
    label: labelArray
  }
};

const processContainer = (status : 'UP' | 'DOWN', labels : any, creationTime : number) => {
  const appGroup = ('deployment.appGroup' in labels) ? labels['deployment.appGroup'] : null;
  const issueIdentifier = ('deployment.issue.identifier' in labels) ? labels['deployment.issue.identifier'] : null;
  const issueUrl = ('deployment.issue.url' in labels) ? labels['deployment.issue.url'] : null;

  let message : DeploymentUpdateEvent = {
    name : labels['deployment.name'],
    status,
    creationTime,
    url : labels['deployment.url'],
    appGroup,
    lastCommit : {
      ref : labels['deployment.vcs.ref'],
    }
  };

  if (issueIdentifier && issueUrl) {
    message.issue = { identifier : issueIdentifier, url : issueUrl };
  }

  publisher.publishMessage(message);
};

dockerClient.listContainers(listOptions, (err, containers : ContainerInfo[]) => {
  if (err) return console.error(err.message, err);

  containers.forEach((container : ContainerInfo) => {
    let labels : any = container.Labels;
    console.log("See container!", container);
    processContainer("UP", labels, container.Created);
  });
});


dockerClient.getEvents(eventStreamOptions, function(err, stream) {
  if (err) return console.error(err.message, err);
  console.log("Listening for Docker events");
  stream.setEncoding('utf8');

  stream.on('data', function(chunk) {
    let data = JSON.parse(chunk.toString());
    console.log("Received event", chunk);
    const action = (data.Action == 'start') ? 'UP' : 'DOWN';
    processContainer(action, data.Actor.Attributes, action == 'UP' ? data.time : -1);
  });

  stream.on('close', function() {
    console.warn("Connection to Docker daemon has been lost");
  });
});
