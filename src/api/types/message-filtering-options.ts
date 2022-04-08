// The startDay and endDay support a variety of formats. In all cases the value is interpreted as a day, not a time,
// even if the value includes a time. Days are in UTC. Examples of ways to specify days:
//
// 0                          - today
// -1                         - yesterday
// -7                         - seven days ago
// 1634027900576              - 2021-10-12
// "2021-10-12T08:38:20.576Z" - 2021-10-12
// "2021-10-12"               - 2021-10-12
// Date.now()                 - today
// new Date()                 - today
export interface MessageFilteringOptions {
  startDay?: number | string | Date
  endDay?: number | string | Date
}
