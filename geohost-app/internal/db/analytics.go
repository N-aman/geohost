package db

import (
	"database/sql"
	"fmt"
	"time"
)

type PageviewEvent struct {
	ProjectID   int64     `json:"project_id"`
	VisitorHash string    `json:"visitor_hash"`
	Path        string    `json:"path"`
	Referrer    string    `json:"referrer"`
	Country     string    `json:"country"`
	Device      string    `json:"device"`
	CreatedAt   time.Time `json:"created_at"`
}

type DailyMetric struct {
	Date           string `json:"date"`
	Pageviews      int64  `json:"pageviews"`
	UniqueVisitors int64  `json:"unique_visitors"`
}

type StatItem struct {
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

type AnalyticsSummary struct {
	ProjectID      int64         `json:"project_id"`
	TotalPageviews int64         `json:"total_pageviews"`
	UniqueVisitors int64         `json:"unique_visitors"`
	Days           int           `json:"days"`
	ByDay          []DailyMetric `json:"by_day"`
	ByCountry      []StatItem    `json:"by_country"`
	ByDevice       []StatItem    `json:"by_device"`
	ByPath         []StatItem    `json:"by_path"`
}

// BatchRecordPageviews writes multiple pageview events in a single transaction.
func (d *DB) BatchRecordPageviews(events []PageviewEvent) error {
	if len(events) == 0 {
		return nil
	}

	tx, err := d.conn.Begin()
	if err != nil {
		return fmt.Errorf("starting analytics transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO pageviews (project_id, visitor_hash, path, referrer, country, device, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	)
	if err != nil {
		return fmt.Errorf("preparing pageview insert: %w", err)
	}
	defer stmt.Close()

	for _, e := range events {
		if e.Path == "" {
			e.Path = "/"
		}
		if e.Country == "" {
			e.Country = "XX"
		}
		if e.Device == "" {
			e.Device = "desktop"
		}
		t := e.CreatedAt
		if t.IsZero() {
			t = time.Now()
		}
		_, err := stmt.Exec(e.ProjectID, e.VisitorHash, e.Path, e.Referrer, e.Country, e.Device, t)
		if err != nil {
			return fmt.Errorf("executing pageview insert: %w", err)
		}
	}

	return tx.Commit()
}

// GetAnalyticsSummary returns aggregated statistics for a project over the last N days.
func (d *DB) GetAnalyticsSummary(projectID int64, days int) (*AnalyticsSummary, error) {
	if days <= 0 {
		days = 30
	}
	since := time.Now().AddDate(0, 0, -days)

	summary := &AnalyticsSummary{
		ProjectID: projectID,
		Days:      days,
		ByDay:     []DailyMetric{},
		ByCountry: []StatItem{},
		ByDevice:  []StatItem{},
		ByPath:    []StatItem{},
	}

	// 1. Total pageviews & unique visitors
	err := d.conn.QueryRow(
		`SELECT COUNT(*), COUNT(DISTINCT visitor_hash) 
		 FROM pageviews 
		 WHERE project_id = ? AND created_at >= ?`,
		projectID, since,
	).Scan(&summary.TotalPageviews, &summary.UniqueVisitors)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("querying total pageviews: %w", err)
	}

	// 2. Breakdown by day (using strftime on created_at)
	dayRows, err := d.conn.Query(
		`SELECT strftime('%Y-%m-%d', created_at) as day, 
		        COUNT(*) as pvs, 
		        COUNT(DISTINCT visitor_hash) as uvs
		 FROM pageviews 
		 WHERE project_id = ? AND created_at >= ?
		 GROUP BY day 
		 ORDER BY day ASC`,
		projectID, since,
	)
	if err == nil {
		defer dayRows.Close()
		for dayRows.Next() {
			var m DailyMetric
			if err := dayRows.Scan(&m.Date, &m.Pageviews, &m.UniqueVisitors); err == nil {
				summary.ByDay = append(summary.ByDay, m)
			}
		}
	}

	// 3. Top countries
	countryRows, err := d.conn.Query(
		`SELECT country, COUNT(*) as cnt
		 FROM pageviews 
		 WHERE project_id = ? AND created_at >= ?
		 GROUP BY country 
		 ORDER BY cnt DESC 
		 LIMIT 10`,
		projectID, since,
	)
	if err == nil {
		defer countryRows.Close()
		for countryRows.Next() {
			var item StatItem
			if err := countryRows.Scan(&item.Name, &item.Count); err == nil {
				summary.ByCountry = append(summary.ByCountry, item)
			}
		}
	}

	// 4. Device breakdown
	deviceRows, err := d.conn.Query(
		`SELECT device, COUNT(*) as cnt
		 FROM pageviews 
		 WHERE project_id = ? AND created_at >= ?
		 GROUP BY device 
		 ORDER BY cnt DESC`,
		projectID, since,
	)
	if err == nil {
		defer deviceRows.Close()
		for deviceRows.Next() {
			var item StatItem
			if err := deviceRows.Scan(&item.Name, &item.Count); err == nil {
				summary.ByDevice = append(summary.ByDevice, item)
			}
		}
	}

	// 5. Top paths
	pathRows, err := d.conn.Query(
		`SELECT path, COUNT(*) as cnt
		 FROM pageviews 
		 WHERE project_id = ? AND created_at >= ?
		 GROUP BY path 
		 ORDER BY cnt DESC 
		 LIMIT 10`,
		projectID, since,
	)
	if err == nil {
		defer pathRows.Close()
		for pathRows.Next() {
			var item StatItem
			if err := pathRows.Scan(&item.Name, &item.Count); err == nil {
				summary.ByPath = append(summary.ByPath, item)
			}
		}
	}

	return summary, nil
}

