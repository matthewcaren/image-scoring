# tangram_construction experiments
This directory contains experiment code (e.g., HTML/CSS/JavaScript) for this project.
Each heading is one experiment, and each subheading is an iteration (iterName or iterationName in raw JSON data and client files) of that experiment.

All experiments were run on Prolific.

## how to run
On linux server with access to its mongoDB instance, run this (preferably in a tmux session):
```bash
cd image-scoring/experiments
node app.js 2>&1 | tee -a SERVERLOGFILEPATH.log
```
Look at the output for the port being exposed.

then in a browser, navigate to:
`https://EXPOSEDSERVERURL.ORG:[PORT]/[EXPERIMENTDIR]/experiment.html?[PROLIFIC_URL_PARAMS]`.

# tan synthesis retreival pilots
## `tangramConstruction_pilot_v0`
initial experiment pilot, for development only.
Initial stimulus set used in all pilots, 12 tangrams in two sets.

## `tangramConstruction_pilot_v0friends`
A handful of non-naive subjects.

## `tangramConstruction_pilot_v1friends`
changes include:
* better recording of condition assignment and set label of each trial
* slight modifications to instructions
* record whether tan is inside or outside dock upon each interaction
* switch to silhouettes for tangram stimuli

## `tangramConstruction_pilot_v1`
_commit: see tag pilot_v1_

First naive sample with N=4 subjects on Prolific.
3 in B-A condition, 1 in A-B condition.
changes:
* new stimulus sets.
  * In each (of two) set(s), each primitive tan is used four times in conjunction with the macro.
  * New macros.
  * Tans sometimes joined on 'half' notches.
* Learn phase is 12 trials (all tangrams in set shown) and switch phase is 6 trials.
* retrievals marked in client with `isRetrieval` column.
* better instructions (more colloquial terms)
* trial timeout not enforced. (no monetary bonuses either)
* in setA, trial id 3 and trial id 5 are the same tangram made with either a square or parallelogram + setA macro. This was undesired

## `tangramConstruction_pilot_v2`
_commit: see tag pilot_v2_
Full naive sample on Prolific N=83 (N=78 with exclusions).
changes:
* record final tans state at end of trial in additional field.
* in switch condition, sample trials so that each non-macro tan (there are three) appears twice for a total of 6 trials.
* fix timer text in tangram reconstruction trials
* fixed repeated tangram in setA by changing trial ids 1, 3, and 5 so there are no ambiguous or duplicate tangrams.

## `tangramConstruction_pilot_v3`
_commit: see tag pilot_v3_
Prolific sample of N=23 (N=20 with exclusions, 9 in A-B condition, 11 in B-A condition).
changes:
* add occluder over tangram stimulus. occluder disappears showing tangram when ppt mouses over the image, but immediately appears when mouse leaves the image.
  * mouse on and mouse off are logged as `revealStim` and `hideStim` interactionTypes, respectively

# tan synthesis retrieval main experiments
## `tangramConstruction_2macroDoublePrim`
_commit: see tag 2macroDoublePrim_
Prolific sample of goal N=53 (N=42 after exclusions, 20 in A-B condition, 22 in B-A condition).
changes:
* each stimulus tangram is generated as follows:
  * 2 instances of macro, plus 2 instances of the same off-macro primitive
  * Tangrams of this type were sampled and we manually selected 12 for each set, where each off-macro primitive
  was used in 4 of those trials.
  * macros are the same: macroA is medtriangle + small triangle, and macroB is square + parallelogram.
* framerate was increased to 60 fps to prevent technical errors in recording interactions.
* TODO: persistent storage of stimuli used for this experiment.

# tan synthesis retrieval WM pilots
## `tangramConstruction_pilot_wmfriends`
_commit: see tag pilot_wmfriends_
Informal friends & family pilot, N=2 on 10 second encoding duration.
Some other incomplete participants in there.
changes (from `2macroDoublePrim`, same stimuli):
* stimulus tangram is presented unoccluded to subject for 10 or 20 seconds (pooling this whole dataset) on its own (in center), then
  * encoding duration is between-subject condition
* participants reconstruct the tangram with no view of target (also in the center)
* see also /plan/plan.md for draft pre-registration for this iteration

## `tangramConstruction_pilot_wm`
_commit: see tag pilot_wm_
naive Prolific sample of total N=87 participants; with this breakdown (after exclusions):
* 4s: 48
* 8s: 19
* 10s: 3
* 16s: 20
* 20s: 5
No procedure/interface changes from `tangramConstruction_pilot_wmfriends`.
Note that analysis was done only with subjects in the 4s, 8s, and 16s encoding durations.

## `tangramConstruction_pilot_wm_inventory_debug`
TODO: _commit: see tag pilot_wm_inventory_debug_
This iteration has data collected from some of the later pilot_wm_inventory iterations, but all for technical development.

Changes from `tangramConstruction_pilot_wm`:
* inventory is now on top of assembly environment, and much larger.
* tans in dock are hidden at start, but appear when a fixation cross is clicked at bottom-center of dock.
* tans are initialized in a semicircle above the fixation cross, so that their (bounding-box) centers are equidistant from the fixation cross.
* when grabbing a tan from the dock, clicking anywhere in a circular region around the tan's center will grab the tan (same size circle for all tans), so that shortest distance to grab any particular tan from the dock toggle is the same.
  * these circular "hitboxes" are displayed in dark grey
* Moving a tan is now accomplished with click to "grab", then click again to "drop" (this is a toggleable option)
* if any tan is dropped in the dock area, it glides back to that tan type's initial starting point (this happens invisibly if tans in dock are hidden)
* mouse movements are tracked between clicking the fixation cross and picking up a tan (or leaving the dock area without a tan)
* A number of aesthetic changes:
  * the assembly canvas is larger (630 x 630 px) and has rounded corners.
  * Reset and Submit buttons are larger and repositioned (bottom left and right under canvas)
  * Switched to Roboto font throughout.
  * All colors have changed: purple tans, light purple workspace, beige dock...
  * cursor changes to a hand when over a button or manipulable tan.

## `tangramConstruction_pilot_wm_inventory_friends`
_commit: see tag pilot_wm_inventory_friends_
Same interface as `tangramConstruction_pilot_wm_inventory_debug`
Small N=3? pilot of non-naive friends with encoding duration 8 seconds.

## `tangramConstruction_pilot_wm_inventory`
_commit: see tag pilot_wm_inventory_
Same interface as `tangramConstruction_pilot_wm_inventory_friends`
N=5, all in A->B condition.
Some trials were never saved to mongoDB, likely because of the
100KB document size limit.

## `tangramConstruction_pilot_wm_inventory_2`
_commit: see tag pilot_wm_inventory_2_
Same as `tangramConstruction_pilot_wm_inventory`, with the following (back end) changes:
* every interaction is logged separately and stored in database
* max data size for any packet of data, including all measures from a single trial, is 25MB
This should fix the issue with some trials dropping.
Collected N=1 non-naive (i.e. ME).

## `tangramConstruction_pilot_wm_inventory_3`
_commit: see tag pilot_wm_inventory_3_
Same as `tangramConstruction_pilot_wm_inventory_3`.
N=6, 3 in A>B and 3 in B>A condition.
Collected an additional participant in B>A condition but a trial was dropped due to error, so currently excluded.

## `tangramConstruction_pilot_wm_inventory_4`
_commit: see tag pilot_wm_inventory_4_
Same as `tangramConstruction_pilot_wm_inventory_3`, but with:
* macro tans always appear 90 degrees apart from each other in semicircular dock (randomly)
  * that is, there are always two primitive tans between the macro tans in the dock order, which is constant within participants but randomized between participants.

## `tangramConstruction_pilot_wm_inventory_feedback_debug`
TODO: _commit: see tag pilot_wm_feedback_
This iteration is a placeholder for data logged during testing / technical development.
changes from `pilot_wm_inventory_4`:
* after reconstruction, participants get visual feedback:
  * their reconstruction (decomposed) is overlaid by the ground truth tangram (silhouette) with some transparency
  * feedback duration is 8 seconds; automatically advances to next trial

# prepcook (fast experience -> self-create macro) pilots
Significant experiment redesign.
Code for these experiments are spread across the `prepcook` directory (design and stimuli randomization) and the `jspsych-tangram-prep` directory (plugins for standalone trials).
Data is stored in tangram_construction 'prepcook' collection in server mongoDB instance.

Tangram trial plugins are published on npm [here](https://www.npmjs.com/package/jspsych-tangram).

## `tangramConstruction_prepcook_debug`
_commit: see tag prepcook_debug_ (TODO)
Implemented the design drafted in [our preregistration currently hosted here](https://docs.google.com/document/d/1RLpyqiUsu9Kw82WcJkdDXjZDAePL7i9YRCxttjZihzM/edit?usp=sharing).
In basic terms:
* subj sees array of 4 tangram silhouettes at once, spread across a semicircle. Each silhouette has its decomposition into primitive pieces revealed.
* subj has a smaller semicircle of primitives that they can click to grab and drop onto the target silhouettes.
  * however, these primitives are hidden. Subj must click a lock icon in the center bottom of the semicircle to reveal the primitives each time they grab a new one.
  * subjs are unable to place any tans that would result in a tan "sticking out" from the silhouette on which it's placed. So there are very few incorrect (suboptimal) moves allowed.
* subjs are instructed to reconstruct all the tangrams in under 2 min.
  * this timing was enforced by ending the trial after 2 mins passed.
* after subjs complete this building task, they are told they can use two primitives to assemble a new piece.
  * In all future build rounds (in this iteration there are 4 total), this new piece the subj made appears above the lock icon as an additional piece that is always available.

### stimuli and conditions
* subjects are put in one of two between subj conditions:
  * "patterned" where all tangrams shared a single macro (2 primitives always next to each other, appearing twice in each tangram),
  * or "control" where there is no macro in all the tangrams.
  * for the "patterned" set, we used the setB macro from earlier pilots.
  * For both of these sets, we generated many tangrams and then hand selected 30 tangrams such that every tangram has 6 total tans (where a macro counts as 2 tans). We selected evenly such that the number of times a combination of pieces in a certain tangram (e.g. 2 parallelograms and 2 macroB's) is consistent across all possible combinations.

### terminology
* subj's created piece: macro
* area where primitives are available (when shown): "inventory"
* area where only macros are shown when primitives are hidden: "quickstash"

## `tangramConstruction_prepcook_pilot`
_commit: see tag prepcook_pilot_
* our first pilot of N=4 naive Prolific subjects. We had 3 in the "patterned" condition and 1 in the "control" condition.

## `tangramConstruction_prepcook_pilot2_friends`
_commit: see tag prepcook_pilot2_friends_
Non-naive pilot of N=1 subject, in the patterned condition.
### changes
* set number of tangrams per round to 5 and number of rounds to 3.
* for selecting the 3 * 5 = 15 total tangrams subject sees during study, sample tangrams such that each piece combination is represented evenly.
* add a **"study/exposure" phase** before the build phase (construct multiple tangrams and then prep a macro for future rounds).
  * In this phase, subjs perform the 1-back memory task on all the 15 tangrams they will see during the future build phase.
  * On each trial, subjs see a single tangram presented for 1.5 s. They are instructed to click a button when the tangram they see now is the "Same as previous" tangram they saw.
  * Between tangram presentations, there is a fixation for 1.5s.
  * Every tangram is presented twice during the study phase, for a total of 30 trials.
  * Randomization of tangram order aimed to have ground truth match / non-match rate to be uniform.
* For each subj, **assigned random colors to each primitive piece**, and showed those colors in both the inventory pieces, the internal pieces in each tangram (in all phases), and in the pieces subj's placed.
  * macro pieces that the subject constructed (during prep trials) were always shown in purple.

## `tangramConstruction_prepcook_pilot2`
_commit: see tag prepcook_pilot2_
Naive Prolific sample of N=9, 4 in patterned (setB) and 5 in control condition.
### changes
* revised several instructions for clarity
  * In particular, be clearer about the 1-back task.
  * Match instructions to new colors in actual task.
  * re-record demo GIFs in instructions for each trial type to account for visual changes.

## `tangramConstruction_prepcook_pilot3`
_commit: TODO: see tag prepcook_pilot3_
Naive Prolific sample of N=12, XX in patterned condition.
### changes
* Added 2-alternative forced choice familiarity judgement task:
  * question was: "Which arrangement of pieces did you see more often in the tangrams you were asked to recreate?"
  * options were the ground-truth macros for the patterned sets, and made-up macros for other patterned sets (since we didn't create other ones yet)
  * All participants saw the same trials (in random order): all 6 possible comparisons of each patterned set macro to another patterned set macro.
  * This familiarity phase was presented after the build phase, before the the exit survey.
* In both the n-back ("study" phase) and "familiarity" phase, increase opacity of tangrams to 1.0 (it was much less than that in previous iteration).

## `tangramConstruction_prepcook_pilot4`
_commit: see tag prepcook_pilot4_
Naive Prolific sample of N=4, all 4 in patterned condition.
### changes
* Swap the study phase at the start of the experiment (formerly a 1-back task) with a single exposure trial.
  * view a 3 row by 5 col grid of all tangrams the participant will reconstruct later.
  * Prompt the participant to "Study all of these tangrams. What patterns, if any, do you see?" and ask them to submit a text box with their response.

## `tangramConstruction_prepcook_pilot5`
_commit: see tag prepcook_pilot5_
Naive Prolific sample of N=8, four in patterned condition.
### changes
* increased construct duration time from 2 min (previous) to 5 min

## `tangramConstruction_prepcook_pilot6`
_commit: TODO: see tag prepcook_pilot6_
Naive Prolific sample of N=XX, X in patterned condition.
### changes
* At the end of every construction trial, add a feedback trial:
  * if ppt built all tangrams on previous round, shower window with confetti over the text "nice job!"
  * if the ppt did not build all tangrams, show a fixation cross for the same duration.
* give participants 6 rounds of 3 tangrams (so they build all 30 tangrams in each set).
  * in study trial, participants see a random selection of 15 tangrams from full set
* Revise instructions at beginning to clarify participants' goals:
  * study trial:
    * "Your first job is to determine if there are any patterns in the shapes, such as which pieces consistently appear with which other pieces."
    * "Later, we will give you some small pieces, and ask you to re-assemble these shapes. Here, we highlighted the parts of the shapes with colors to show you which pieces will be used in each shape."
  * construct and prep trials:
    * construct "Please try to recreate all the shapes as quickly as you can."
    * prep "What part would you wish to have in easy reach that would help you construct the shapes faster?"
    * put number of pieces participants can use to create macro in bold

## `tangramConstruction_prepcook_pilot7`
_commit: TODO: see tag prepcook_pilot7_
Naive Prolific sample of N=25, 5 in each set condition (patterned and control)
### changes
* stimuli
  * introduced another macro -> patterned set with the same rotation (labeled 'default_rotations')
  * introduced another rotation of primitive tans, and two macros -> patterned sets with those rotations.
  * so now we have a total of 4 patterned sets plus 1 control set.
* experiment
  * a participant is randomly assigned one of the sets (any of the five total sets)
  * during 'prep' trials, participants now **see their re-assembled tangrams from their last construct round**. So in this pilot, during each prep trial, participants see the 5 tangram reconstructions they just finished.
  * updated experiment code to handle different rotations of primitive tans
  * removed fields from expConfig that are no longer relevant.
