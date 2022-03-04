import { ComponentType } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import { Component, ComponentFactoryResolver, Inject, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { timer } from 'rxjs';
import { first, switchMap, tap } from 'rxjs/operators';
import {
  BlockButtonDialogComponent, BlockButtonDialogData
} from '../block/block-button-dialog/block-button-dialog.component';
import { BlockComponent } from '../block/block.component';
import { ForcedChoiceBlockComponent } from '../block/forced-choice-block-component/forced-choice-block.component';
import { fullScreenDialogWithData } from '../block/full-screen-dialog-with-data';
import { OperantChoiceBlockComponent } from '../block/operant-choice-block-component/operant-choice-block.component';
import { PreTestBlockComponent } from '../block/pre-test-block-component/pre-test-block.component';
import {
  TrainingNetworksBlockComponent
} from '../block/training-networks-block-component/training-networks-block.component';
import { TRIAL_DELAY_INTERVAL_MS } from '../block/trial-animation-delay';
import { ReportStatus } from '../report/report-status';
import { ReportService } from '../report/report.service';
import { StudyConfigService } from '../study-config-form/study-config.service';
import { SurveyService } from '../survey/survey.service';
import { STUDY_INSTRUCTIONS } from './study-instructions';

@UntilDestroy()
@Component({
  selector: 'study',
  templateUrl: './study.component.html',
  styleUrls: ['./study.component.scss'],
  providers: []
})
export class StudyComponent implements OnInit {
  abandonmentEnabled = false;
  blocks: ComponentType<BlockComponent>[] = [
    PreTestBlockComponent,
    ForcedChoiceBlockComponent,
    OperantChoiceBlockComponent,
    TrainingNetworksBlockComponent
  ];
  complete = false;
  @ViewChild('container', { read: ViewContainerRef, static: true }) container?: ViewContainerRef;
  instructions = STUDY_INSTRUCTIONS;
  showInstructions = true;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private componentFactoryResolver: ComponentFactoryResolver,
    private dialog: MatDialog,
    private reportSvc: ReportService,
    readonly studyConfigSvc: StudyConfigService,
    private surveySvc: SurveyService
  ) {
  }

  createBlockComponent(blockComponent: ComponentType<BlockComponent>) {
    if (!this.container) throw Error('Container is undefined');
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(blockComponent);
    this.container.clear();
    const componentRef = this.container.createComponent(componentFactory);
    const blockInstance = componentRef.instance;
    blockInstance.studyConfig = this.studyConfigSvc.config;

    blockInstance.started.pipe(first(), untilDestroyed(this)).subscribe(() => this.abandonmentEnabled = true);

    blockInstance.completed.pipe(first(), tap(({ failed }) => {
      this.abandonmentEnabled = false;
      if (failed) {
        this.showCompleteDialog('failed');
      } else if (this.blocks.length) {
        this.nextBlock();
        this.reportSvc.sendReport('block').then();
      } else {
        this.showCompleteDialog('complete');
      }
    }), untilDestroyed(this)).subscribe();

  }

  nextBlock() {
    this.showInstructions = false;
    const block = this.blocks.shift();
    if (!block) throw Error('Block is undefined');
    this.createBlockComponent(block);
  }

  ngOnInit() {
    this.studyConfigSvc.loadStudyConfigFromParams().then();
  }

  showCompleteDialog(status: ReportStatus) {
    const { participantId } = this.studyConfigSvc;
    const text = status === 'abandoned' ? `STUDY ABANDONED!\n\n PARTICIPANT ID:\n ${participantId}` :
      `THANKS FOR PARTICIPATING!\n\n PARTICIPANT ID:\n ${participantId}`;
    this.complete = true;
    this.container?.clear();
    timer(TRIAL_DELAY_INTERVAL_MS).pipe(
      first(),
      switchMap(() => this.reportSvc.sendReport(status)),
      switchMap(() => status !== 'abandoned' ? this.surveySvc.showPostSurvey(participantId) : [text]),
      switchMap(() => this.dialog.open(BlockButtonDialogComponent,
        fullScreenDialogWithData<BlockButtonDialogData>({ text, disableClose: true })).afterClosed())
    ).subscribe();
  }

  showPreSurvey() {
    this.surveySvc.showPreSurvey(this.studyConfigSvc.participantId).subscribe(() => this.nextBlock());
  }

}
