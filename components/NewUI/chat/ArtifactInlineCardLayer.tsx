/**
 * ArtifactInlineCardLayer — retired. It renders nothing and observes nothing.
 *
 * It used to watch `.chatcontainer` for the classic "Creating Your Artifact…" box and swap
 * it for an inline card. AutoArtifactBlock has drawn its own card (DirectArtifactCard) since
 * the artifact rewrite of 2026-09-23 and no longer emits that text, so the layer could never
 * find anything. It still walked every `div.flex-col` in the transcript, descendant by
 * descendant, on every DOM mutation, which during a reply means on every streamed token
 * (#361, item 1).
 *
 * The component is kept as a no-op so the mount in ConversationViewShell keeps compiling.
 * That mount and this file can be deleted together with the CSS only this layer used in
 * conversation-view.css: the `[data-nui-artifact-creating]` and `[data-nui-inline-card-host]`
 * rules and `.nui-artifact-card-title` / `.nui-artifact-card-type`. The `nui-artifact-shimmer`
 * and `spin` keyframes next to them stay: AutoArtifactBlock's card uses them.
 */

import React from 'react';

export const ArtifactInlineCardLayer: React.FC = () => null;

export default ArtifactInlineCardLayer;
