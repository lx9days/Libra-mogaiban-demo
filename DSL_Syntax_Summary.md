# Visualization Interaction DSL: Syntax and Composition Management

## Abstract
This document outlines the syntax and structure of the Domain-Specific Language (DSL) designed for defining visualization interactions within the Libra system. The DSL adopts a JSON-based configuration model, enabling the specification of interaction rules through a declarative syntax. It encompasses core components such as instruments, triggers, and targets, while also providing robust mechanisms for managing interaction composition and conflict resolution through priority settings, modifier keys, and gesture definitions.

## 1. Core Syntax Structure

The fundamental unit of the DSL is the **Interaction Rule**, which defines a specific interactive behavior. Each rule is constructed using a set of necessary keys that map high-level intent to underlying implementation mechanisms.

### 1.1 Necessary Keys
*   **Instrument (or Interaction)**: This key specifies the high-level type or intent of the interaction. It serves as the primary identifier for the interaction logic. Valid values, as registered in the system (e.g., `atomic.csv`), include `point selection`, `group selection`, `moving`, `reordering`, `panning`, `zooming`, `Lens`, and `helperLine`. The system uses this key to trigger the appropriate construction logic for specialized interactions.
*   **Trigger**: This key defines the specific user event that initiates the interaction. It maps directly to the underlying event listeners. Standard triggers include `Hover`, `Click`, `Brush`, `Drag`, `Pan`, and `Zoom`. For instance, a `Brush` trigger activates the selection mechanism, while a `Drag` trigger might initiate a moving or reordering operation.
*   **Target (or targetLayer)**: This key identifies the visualization layer(s) upon which the interaction operates. It can be specified as a single string representing a layer name (e.g., `"mainLayer"`) or an array of strings for multi-layer targeting.
*   **Feedback (or feedbackOptions)**: This key accepts a configuration object that broadly defines the visual and logical response of the interaction. It acts as a general container for customizing the interaction's feedback loop, encapsulating parameters for styling (e.g., highlight colors), behavioral constraints, and auxiliary information (e.g., tooltips).

## 2. Interaction Composition and Conflict Management

To support complex, multi-modal interaction designs where multiple behaviors may be bound to similar events, the DSL provides a suite of keys dedicated to composition management. These keys—`Priority`, `ModifierKey`, and `Gesture`—enable precise control over interaction activation and conflict resolution.

### 2.1 Modifier Keys
The `modifierKey` (or `ModifierKey`) configuration is used to distinguish interactions that share the same base trigger but represent different user intents. It can be defined at the top level of an interaction rule or within the `Feedback` object.
*   **Type**: A string (e.g., `"Shift"`, `"Alt"`, `"Ctrl"`) or an array of strings (e.g., `["Shift", "Ctrl"]`).
*   **Function**: The interaction is activated only when the specified modifier key(s) are pressed during the trigger event. This allows, for example, a standard `Drag` to perform panning, while `Drag` + `Shift` triggers a selection.

### 2.2 Priority and Event Propagation
When multiple interactions are eligible to be triggered by the same event (and potentially the same modifier keys), the `priority` and `stopPropagation` keys determine the execution order and exclusivity.
*   **Priority**: A numeric value assigned to an interaction rule. Interactions with higher priority values are processed first. This is critical for layering interactions, such as prioritizing a specific tool over a global background interaction.
*   **StopPropagation**: A boolean flag (defaulting to `false`). If set to `true`, the interaction, once successfully triggered, prevents the event from propagating to interactions with lower priority. This ensures that a specific action does not inadvertently trigger conflicting lower-priority actions.

### 2.3 Gesture Definition
For interactions involving continuous input or specific movement patterns, the `gesture` key allows for finer granularity in defining the activation behavior. It helps disambiguate intent based on the nature of the user's movement.
*   **Type**: A string specifying the gesture type.
*   **Valid Values**:
    *   `"stay"`: Triggers when the pointer remains stationary (within a small threshold) for a specific duration. Useful for tooltips or detailed inspections.
    *   `"move"`: Triggers on continuous movement.
    *   `"start-horizontally"`: Triggers only if the initial movement vector is dominant along the X-axis. Useful for distinguishing horizontal gestures (e.g., time scrubbing) from vertical ones.
    *   `"start-vertically"`: Triggers only if the initial movement vector is dominant along the Y-axis.
*   **Function**: By specifying a gesture, developers can bind different interactions to the same base event (like `Drag` or `Hover`) but differentiate them based on the user's physical movement pattern.

## 3. Extension and Customization

### 3.1 Custom Feedback Flow
To accommodate advanced use cases that extend beyond standard feedback behaviors, the DSL supports a `customFeedbackFlow` key within the `Feedback` object. This key provides a mechanism to directly modify the underlying data flow of the interaction.
*   **Structure**: It allows for the insertion, removal, or overriding of services and transformers within the interaction's processing pipeline.
*   **Usage**: Developers can define custom logic flows (e.g., inserting specific data transformation services) or reference pre-defined handlers, enabling the construction of highly specialized interaction techniques without altering the core DSL schema.
