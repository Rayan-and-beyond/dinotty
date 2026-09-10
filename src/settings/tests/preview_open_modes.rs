use super::super::types::Settings;

#[test]
fn preview_open_modes_default_to_empty() {
    let settings = Settings::default();
    assert!(settings.preview_open_modes.is_empty());
}

#[test]
fn preview_open_modes_deserializes_when_present() {
    let settings: Settings =
        serde_json::from_str(r#"{"preview_open_modes":{"files":"floating"}}"#).unwrap();
    assert_eq!(settings.preview_open_modes.get("files").map(String::as_str), Some("floating"));
}

#[test]
fn preview_open_modes_round_trips() {
    let settings: Settings =
        serde_json::from_str(r#"{"preview_open_modes":{"files":"floating"}}"#).unwrap();
    let json = serde_json::to_string(&settings).unwrap();
    assert!(json.contains(r#""preview_open_modes""#));
    let back: Settings = serde_json::from_str(&json).unwrap();
    assert_eq!(back.preview_open_modes.get("files").map(String::as_str), Some("floating"));
}

#[test]
fn preview_open_modes_without_key_deserializes_to_empty() {
    let settings: Settings = serde_json::from_str(r"{}").unwrap();
    assert!(settings.preview_open_modes.is_empty());
}
