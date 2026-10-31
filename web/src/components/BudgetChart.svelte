<script lang="ts">
  import { formatRupees, type BudgetLine, type FunctionAmount } from '@jashn/core';
  import { percent } from '../lib/format.ts';

  /**
   * The budget split as hand-drawn SVG bars with a full table equivalent. The SVG is one image
   * with a text alternative; the table carries every figure for screen readers and print.
   */
  interface Props {
    lines: readonly BudgetLine[];
    contingency: number;
    total: number;
    labelOf: (category: string) => string;
  }
  let { lines, contingency, total, labelOf }: Props = $props();

  /** Chart geometry in viewBox units; CSS caps the rendered width so text stays readable. */
  const WIDTH = 320;
  const ROW = 36;
  const BAR = 12;

  interface Row {
    readonly key: string;
    readonly label: string;
    readonly amount: number;
  }

  const rows: readonly Row[] = $derived([
    ...lines.map((line) => ({
      key: line.category,
      label: labelOf(line.category),
      amount: line.amount,
    })),
    { key: 'contingency', label: 'Contingency', amount: contingency },
  ]);
  const largest = $derived(Math.max(1, ...rows.map((row) => row.amount)));
  const summary = $derived(
    rows.map((row) => `${row.label} ${percent(row.amount / total)}`).join(', '),
  );

  function functionText(slices: readonly FunctionAmount[]): string {
    return slices
      .map((slice) => `${labelOf(slice.functionId)} ${formatRupees(slice.amount)}`)
      .join(', ');
  }
</script>

<figure class="budget-chart">
  <svg
    viewBox="0 0 {WIDTH} {rows.length * ROW}"
    role="img"
    aria-label="Budget split of {formatRupees(total)}: {summary}."
  >
    {#each rows as row, index (row.key)}
      <g transform="translate(0 {index * ROW})">
        <text class="bar-label" x="0" y="13">{row.label}</text>
        <text class="bar-value" x={WIDTH} y="13" text-anchor="end">{formatRupees(row.amount)}</text>
        <rect class="bar-track" x="0" y="18" width={WIDTH} height={BAR} rx="3"></rect>
        <rect
          class="bar {row.key === 'contingency' ? 'bar-reserve' : ''}"
          x="0"
          y="18"
          width={Math.max(2, (row.amount / largest) * WIDTH)}
          height={BAR}
          rx="3"
        ></rect>
      </g>
    {/each}
  </svg>
  <figcaption class="muted">
    Planning estimates for India, not quotes. Amounts are rounded to ₹100.
  </figcaption>
</figure>

<div class="table-wrap">
  <table>
    <caption>Budget split of {formatRupees(total)}</caption>
    <thead>
      <tr>
        <th scope="col">Category</th>
        <th scope="col" class="num">Amount</th>
        <th scope="col" class="num">Share</th>
      </tr>
    </thead>
    <tbody>
      {#each lines as line (line.category)}
        <tr>
          <th scope="row">
            {labelOf(line.category)}
            {#if line.perFunction !== undefined && line.perFunction.length > 0}
              <span class="cell-note">{functionText(line.perFunction)}</span>
            {/if}
          </th>
          <td class="num">{formatRupees(line.amount)}</td>
          <td class="num">{percent(line.share)}</td>
        </tr>
      {/each}
      <tr>
        <th scope="row">Contingency</th>
        <td class="num">{formatRupees(contingency)}</td>
        <td class="num">{percent(contingency / total)}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <th scope="row">Total</th>
        <td class="num">{formatRupees(total)}</td>
        <td class="num">100%</td>
      </tr>
    </tfoot>
  </table>
</div>
