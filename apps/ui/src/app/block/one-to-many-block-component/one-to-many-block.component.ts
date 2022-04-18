import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { OneToManyGraphService } from '../../graph/one-to-many-graph.service';
import { OverlayService } from '../../overlay/overlay.service';
import { ReportService } from '../../report/report.service';
import { StudyConfig } from '../../study-config-form/study-config';
import { Trial } from '../../trial/trial';
import { FeedBackDialogData } from '../../trial/trial-correct/feed-back-dialog.data';
import { TrialCounterService } from '../../trial/trial-counter.service';
import { TrialCompleted } from '../../trial/trial.component';
import { BlockComponent } from '../block.component';
import { randomizedComponentConfigs } from '../cue-component-configs';
import { TRIAL_DELAY_INTERVAL_MS } from '../trial-animation-delay';

interface Stimulus1And2 {
  stimulus1: string,
  stimulus2: string
}

@Component({
  selector: 'one-to-many-block',
  templateUrl: './one-to-many-block.component.html',
  styleUrls: ['./one-to-many-block.component.scss'],
  animations: [],
})
export class OneToManyBlockComponent extends BlockComponent implements OnInit {
  name = 'One To Many Block';
  probeTrialWithoutFeedbackStart = 32;
  resettingCorrectCount = 0;
  sequentialCorrectRequiredToAdvance = 3;
  startInstructions = 'CLICK TO CONTINUE';

  constructor(
    dialog: MatDialog,
    overlaySvc: OverlayService,
    reportSvc: ReportService,
    trialCounterSvc: TrialCounterService,
    private oneToManyGraph: OneToManyGraphService,
  ) {
    super(dialog, overlaySvc, reportSvc, trialCounterSvc);
  }

  private get finalNetwork() {
    return this.studyConfig.iCannotKnow ? [16] : [15];
  }

  private get trainingNetworks() {
    return this.studyConfig.iCannotKnow ? this.oneToManyGraph.ickNetworkNumbers :
      this.oneToManyGraph.knownNetworkNumbers;
  }

  createTrials() {
    const trainingTrials = this.getOrderedTrials(this.trainingNetworks, COMPARISONS_WITH_FEEDBACK);
    const probeTrialsWithFeedback = this.getOrderedTrials(this.finalNetwork, PROBE_COMPARISON_WITH_FEEDBACK);
    const probeTrialsWithoutFeedback = this.getOrderedTrials(this.finalNetwork, PROBE_COMPARISONS_WITHOUT_FEEDBACK);

    return trainingTrials.concat(probeTrialsWithFeedback, probeTrialsWithoutFeedback);
  }

  feedbackEnabled(): boolean {
    return this.index < this.probeTrialWithoutFeedbackStart;
  }

  grade(selected: TrialCompleted): FeedBackDialogData['feedback']|undefined {
    if (!this.trial) throw Error('Trial is undefined');
    const isCorrect = selected?.cue?.value === this.trial.relation;

    if (selected?.cue?.value === this.trial.relation) {
      this.correct++;
      if (this.index < this.probeTrialWithoutFeedbackStart) this.resettingCorrectCount++;
      this.sequentialCorrect++;
    } else {
      this.incorrect++;
      this.sequentialCorrect = 0;
      if (this.index < this.probeTrialWithoutFeedbackStart) this.resettingCorrectCount = 0;
    }

    return isCorrect ? 'CORRECT' : 'WRONG';
  }

  nextTrial() {

    if (this.index >= this.probeTrialWithoutFeedbackStart) {
      this.resettingCorrectCount++;
      if (this.resettingCorrectCount < this.sequentialCorrectRequiredToAdvance) {
        (this.trial as Trial).cueComponentConfigs = randomizedComponentConfigs(this.studyConfig as StudyConfig);
        this.index--;
      } else {
        this.resettingCorrectCount = 0;
      }
      return super.nextTrial();
    }

    if (this.resettingCorrectCount < this.sequentialCorrectRequiredToAdvance && this.index > -1) {
      (this.trial as Trial).cueComponentConfigs = randomizedComponentConfigs(this.studyConfig as StudyConfig);
      this.index--;
    } else {
      this.resettingCorrectCount = 0;
    }
    super.nextTrial();
  }

  ngOnInit(): void {
    this.start();
  }

  /***
   * Resets block index, correct count, incorrect count, and generates fresh trials.
   */
  reset() {
    this.index = -1;
    this.correct = 0;
    this.incorrect = 0;
    this.trials = this.createTrials();
  }

  start() {
    if (this.trials.length === 0) this.reset();
    this.prompt(this.startInstructions, false, TRIAL_DELAY_INTERVAL_MS)
      .subscribe(() => {
        this.started.next();
        this.nextTrial();
      });
  }

  private getOrderedTrials(networks: ReadonlyArray<number>, comparisons: Stimulus1And2[]) {
    const trials: Trial[] = [];
    for (const network of networks) {
      for (const { stimulus1, stimulus2 } of comparisons) {
        const stimulusComparison = this.oneToManyGraph.getStimulusComparison(stimulus1, network, stimulus2, network);

        trials.push({
          ...stimulusComparison,
          cueComponentConfigs: randomizedComponentConfigs(this.studyConfig as StudyConfig),
        });
      }
    }
    return trials;
  }
}

const COMPARISONS_WITH_FEEDBACK: Stimulus1And2[] = [
  { stimulus1: 'A', stimulus2: 'B' },
  { stimulus1: 'B', stimulus2: 'A' },
  { stimulus1: 'B', stimulus2: 'C' },
  { stimulus1: 'C', stimulus2: 'B' },
  { stimulus1: 'C', stimulus2: 'A' },
  { stimulus1: 'A', stimulus2: 'C' },
];

const PROBE_COMPARISON_WITH_FEEDBACK: Stimulus1And2[] = [
  { stimulus1: 'A', stimulus2: 'B' },
  { stimulus1: 'B', stimulus2: 'C' },
];

const PROBE_COMPARISONS_WITHOUT_FEEDBACK: Stimulus1And2[] = [
  { stimulus1: 'B', stimulus2: 'A' },
  { stimulus1: 'C', stimulus2: 'B' },
  { stimulus1: 'C', stimulus2: 'A' },
  { stimulus1: 'A', stimulus2: 'C' },
];
