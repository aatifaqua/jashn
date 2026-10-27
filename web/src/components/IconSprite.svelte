<script lang="ts">
  // Every icon as a <symbol> in one hidden inline SVG, referenced by Icon.svelte with <use>.
  // Strokes use currentColor, so icons follow the text colour in every theme and in forced colours.
</script>

<svg class="sprite" aria-hidden="true" focusable="false">
  <defs>
    <symbol id="i-check" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M8 12.5l2.7 2.7L16.2 9.5"></path>
    </symbol>
    <symbol id="i-alert" viewBox="0 0 24 24">
      <path d="M12 3.5L2.5 20h19z"></path>
      <path d="M12 10v4.5M12 17.2v.3"></path>
    </symbol>
    <symbol id="i-stop" viewBox="0 0 24 24">
      <path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z"></path>
      <path d="M9 9l6 6M15 9l-6 6"></path>
    </symbol>
    <symbol id="i-clock" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M12 7v5l3.5 2"></path>
    </symbol>
    <symbol id="i-calendar" viewBox="0 0 24 24">
      <rect x="3.5" y="5" width="17" height="15" rx="2"></rect>
      <path d="M3.5 10h17M8 3v4M16 3v4"></path>
    </symbol>
    <symbol id="i-copy" viewBox="0 0 24 24">
      <rect x="8.5" y="8.5" width="12" height="12" rx="2"></rect>
      <path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"></path>
    </symbol>
    <symbol id="i-print" viewBox="0 0 24 24">
      <path
        d="M7 9V3.5h10V9M7 17H4.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H17"
      ></path>
      <path d="M7 14h10v6.5H7z"></path>
    </symbol>
    <symbol id="i-link" viewBox="0 0 24 24">
      <path d="M10 14a4 4 0 0 0 5.7 0l3.5-3.5a4 4 0 0 0-5.7-5.7l-1 1"></path>
      <path d="M14 10a4 4 0 0 0-5.7 0l-3.5 3.5a4 4 0 0 0 5.7 5.7l1-1"></path>
    </symbol>
    <symbol id="i-spark" viewBox="0 0 24 24">
      <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"></path>
      <path d="M19 16v4M17 18h4"></path>
    </symbol>
    <symbol id="i-send" viewBox="0 0 24 24">
      <path d="M4 12l16-8-6 16-2.5-6.5z"></path>
      <path d="M11.5 13.5L20 4"></path>
    </symbol>
    <symbol id="i-sun" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4"></circle>
      <path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"
      ></path>
    </symbol>
    <symbol id="i-moon" viewBox="0 0 24 24">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"></path>
    </symbol>
    <symbol id="i-trash" viewBox="0 0 24 24">
      <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 13.5h10l1-13.5M10 10.5v6M14 10.5v6"></path>
    </symbol>
    <symbol id="i-info" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M12 11v6M12 7.5v.3"></path>
    </symbol>
  </defs>
</svg>
