import { LatLng, Marker, Map } from "leaflet";

export class PlayerState {
  private location: LatLng;
  private marker: Marker;
  private map: Map;

  constructor(initialLocation: LatLng, map: Map) {
    this.location = initialLocation;
    this.map = map;

    // Add player marker to the map
    this.marker = new Marker(this.location);
    this.marker.bindTooltip("That's you!").addTo(map);
  }

  // Getter for player location
  getLocation(): LatLng {
    return this.location;
  }

  // Update player location
  setLocation(newLocation: LatLng): void {
    this.location = newLocation;
    this.marker.setLatLng(newLocation);
    this.map.setView(newLocation); // Move map to center on player
  }
}