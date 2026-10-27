<script lang="ts">
  import { SAMPLE_IDS, sampleLabel, type SampleId } from '@jashn/core';

  /** One-click sample events, so a first visit shows a full plan without typing. */
  interface Props {
    onpick: (id: SampleId) => void;
    disabled?: boolean;
  }
  let { onpick, disabled = false }: Props = $props();
</script>

<section class="samples" aria-labelledby="samples-title">
  <h2 id="samples-title">Try a sample</h2>
  <ul class="chip-list">
    {#each SAMPLE_IDS as id (id)}
      <li>
        <button
          type="button"
          class="chip"
          {disabled}
          onclick={() => {
            onpick(id);
          }}>{sampleLabel(id)}</button
        >
      </li>
    {/each}
  </ul>
</section>
