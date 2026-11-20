# kit8/ui/project/assistant - the Create New Project Assistant (built 2026-11-17, first version)

React Native Paper screens (the MD3 theme of the app). Routes: `app/pm/project/assistant` (the assistant) and `app/pm/project/assistant/import` (Import Project).

## Where it is called from
| Caller | What happens |
|---|---|
| main FAB of the appPM80 home, item **New Project** (`apps/appPM80/customization.ts`) | `/pm/project/assistant` = the first screen (a guest signs in first) |
| `+ Project` menu of the project bar, item **Assistant** (`PMRecentProjectsToolbar`) | the same first screen |
| three dots menu of the Project settings window, item **Project assistant** | `/pm/project/assistant?mode=assistant&target=new|<projectGUID>`: no first screen; the answers of the window (a new project or the project being edited) are the starting answers |

| `?mode=assistant&target=organization` (the **Create Organization Assistant**, `kit8/ui/organization/assistant`) | the same questions WITHOUT the name and the schedule; the end is **Save as default settings**: the answers (over the stored ones) become `defaultProjectSettings` of the active organization (`AssistantEnvironment.saveOrganizationDefaults`), no project is made, the user goes back to the list of organizations |

## The first screen - "How do you want to create the project?"
1. **Assistant mode** - the questions below. 2. **Manual input** - the New project window of the dashboard (`openProjectSettings('new')`). 3. **Import Project** - `ImportNewProjectAssistant`.
An unfinished run of the user is offered first (**Continue where you stopped** / Start again).

## The questions (the order of a project manager: what -> when -> how fine -> money -> resources -> control)
`model/assistantModel.ts` (pure, tested): **Name** -> **Schedule** (start, finish, day / hour accuracy of the inputs, weekends) -> **Planning model** (Day by day | Hour by hour, unit of the resource load = Project settings -> Resources) -> **Time of day** (asked ONLY for Hour by hour, the fields in the order of the Resources tab: step in minutes 1 / 5 / 10 / 15 / 30 / 60, time zone with "This device" / UTC, working windows `09:00-13:00, 14:00-18:00` with presets 8 hours / lunch break / two shifts / round the clock) -> **Currencies** -> **Budgets** (revenue, cost: time / material / expenses) -> **Resources** (people / equipment / partners; asked only while time costs are on) -> **Resource optimization** (same condition: master switch, Manual | Automatic, Leveling | Smoothing, leveling order, where a run is calculated = this device | database, what to do when a posted task must move) -> **Control** (ROI per task, customer invoices, subprojects, chat) -> **Review**.
The three steps of 2026-11-18 cover the Resources tab of the Project settings window (settings models: `kit8/pm/hourmodel/hourModelSettings.ts`, `kit8/pm/resourceleveling/resourceLevelingSettings.ts`). Rules: an invalid zone / working windows is an ERROR (blocks Next); a window that is not a whole number of steps, less than 4 working hours, a project over 90 days by the hour, Automatic optimization = warnings. The patch writes `projectTimeZone` / `resourceSlotMinutes` / `projectWorkWindows` only for the hour model (the day model never reads them) and sets `planHour` when the hour model is chosen.
Every step shows the *expert advice* (why it is asked now) and notes of the answers: an error blocks Next, a warning / info only advises (finish before start, a project over two years -> split it, revenue without cost = no ROI, a duplicate name ...).
* **Currencies**: EACH PROJECT OWNS ITS currencies, so budget / accounting / contract currency are PICKED from the currency catalog in every run (`SelectElementFromCatalog`, the picker of the Project settings window; never typed) (a new project starts from the defaults of the organization; a saved project from its own; budget + accounting obligatory, contract empty = budget). The window that receives them asks the approval / refuses by the posted documents as for any currency change (`PMRecentProjectsToolbar.saveDraft`, SQL `project_currency_guard`). The **consolidation currency** (`currencyForConsolidation` of the organization, Organization edit -> Consolidation) is shown read only under them and in the review. The assistant no longer writes currencies to the organization.
* **Navigation line** at the top (one chip per step: done / current / to do), a back arrow, Back / Next at the bottom of ONE panel of a FIXED height (`panelHeight` in `CreateNewProjectAssistant`: the window height minus the bar, 420..720 px; the step body scrolls inside it, so the buttons stand at the same place on every step): the user can always go back to a step already seen (`model/assistantFlow.ts`), never ahead. **Save and exit** keeps the answers.
* **Last input is stored** on the device (`model/assistantStorage.ts`, AsyncStorage, key `pm.projectAssistant.v1.<user>.<new|projectGUID>`, saved 400 ms after every change and when the screen closes; cleared when the run ends). The next run offers to continue at the step where the user stopped; a run with nothing typed is not offered.

## The end
**Create project** or **Open in the project window**: the answers go to `usePMStore.applyProjectAssistant({ target, patch, createNow })`; `PMRecentProjectsToolbar` merges the patch into the New project window (`target = 'new'`) or the settings window of a project and, for Create, saves it at once with its own `saveDraft` (the business units check, permissions ... stay where they were; a refusal stays visible in the window). The assistant never writes a project row itself.

## Import Project (`import/ImportNewProjectAssistant.tsx`)
File (a project_data_….json is read and summarised) -> Name -> Import: creates the project with the default settings of the organization + its four business units, loads the file into it (`useProjectExchange.importProject`), selects it and opens the dashboard; a project left empty by a failed import is deleted again.

## Folders
`model/` (assistantModel, assistantFlow, assistantStorage - pure) · `hooks/` (`useAssistantEnvironment` = user / projects / organization, `useCreateAssistant` = the state machine + saving + hand over) · `components/` (navigation bar, expert card, fields) · `steps/` (one component per step) · `create/` (screen + first screen) · `import/`.

## Not built (first version)
Of the Resources tab the assistant does not ask: Fast mode, the posted-tasks switch, the option switches (clear before leveling, splits, manual tasks, other projects, delay bar, over-allocation mark, history) - they keep their defaults; change them in the window ("Open in the project window").
Project manager, main customer / supplier and the contracts, calendar, business units, budget scenarios and the other tabs of the project window are not asked (the window has them: "Open in the project window"); other languages (the texts go through `pmT`, English only); the import assistant does not keep its input (a file cannot be kept); no voice / AI free text input - the "expert" is a rule set, not a model.

Tests: `__tests__/ui/project/assistant` (model, flow, storage, import model, the screen), `__tests__/apps/appPM80/fab.test.tsx`.
