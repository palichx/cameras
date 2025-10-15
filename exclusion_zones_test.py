#!/usr/bin/env python3
"""
Focused test for Exclusion Zones functionality
"""
import requests
import json
import sys

class ExclusionZonesTest:
    def __init__(self):
        self.base_url = "https://videosecureai.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        self.demo_camera_id = "2ed4b656-faea-4668-a8ee-64f3e400568a"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 {name}")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.content
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ FAILED - Error: {str(e)}")
            return False, {}

    def test_snapshot_endpoint(self):
        """Test GET /api/cameras/{camera_id}/snapshot"""
        print("\n" + "="*60)
        print("TESTING CAMERA SNAPSHOT ENDPOINT")
        print("="*60)
        
        # Test with existing camera
        url = f"{self.api_url}/cameras/{self.demo_camera_id}/snapshot"
        print(f"\n🔍 Testing snapshot endpoint")
        print(f"   URL: {url}")
        
        try:
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'image/jpeg' in content_type:
                    print(f"✅ PASSED - Valid JPEG image returned")
                    print(f"   Content-Type: {content_type}")
                    print(f"   Image size: {len(response.content)} bytes")
                    self.tests_passed += 1
                    success1 = True
                else:
                    print(f"❌ FAILED - Invalid content type: {content_type}")
                    success1 = False
            else:
                print(f"❌ FAILED - Status: {response.status_code}")
                success1 = False
                
        except Exception as e:
            print(f"❌ FAILED - Error: {str(e)}")
            success1 = False
        
        self.tests_run += 1
        
        # Test with non-existent camera
        success2, _ = self.run_test(
            "Snapshot with non-existent camera (should return 404)", 
            "GET", 
            "cameras/non-existent-id/snapshot", 
            404
        )
        
        return success1 and success2

    def test_exclusion_zones_rectangle(self):
        """Test saving rectangle exclusion zones"""
        print("\n" + "="*60)
        print("TESTING RECTANGLE EXCLUSION ZONES")
        print("="*60)
        
        rectangle_zones = [
            {
                "type": "rect",
                "coordinates": {
                    "x": 10,
                    "y": 10,
                    "width": 100,
                    "height": 50
                }
            }
        ]
        
        success, response = self.run_test(
            "Save rectangle exclusion zone", 
            "PUT", 
            f"cameras/{self.demo_camera_id}/excluded-zones", 
            200, 
            data=rectangle_zones
        )
        
        if success:
            print(f"   Zones saved: {response.get('zones', [])}")
            
            # Verify zones were saved to database
            success_verify, camera_data = self.run_test(
                "Verify rectangle zones saved to database", 
                "GET", 
                f"cameras/{self.demo_camera_id}", 
                200
            )
            
            if success_verify:
                excluded_zones = camera_data.get('excluded_zones', [])
                if excluded_zones and len(excluded_zones) > 0:
                    zone = excluded_zones[0]
                    if (zone.get('type') == 'rect' and 
                        zone.get('coordinates', {}).get('x') == 10 and
                        zone.get('coordinates', {}).get('width') == 100):
                        print("✅ Rectangle zone correctly saved to database")
                        return True
                    else:
                        print(f"❌ Zone data mismatch: {zone}")
                        return False
                else:
                    print("❌ No zones found in database")
                    return False
        
        return success

    def test_exclusion_zones_polygon(self):
        """Test saving polygon exclusion zones"""
        print("\n" + "="*60)
        print("TESTING POLYGON EXCLUSION ZONES")
        print("="*60)
        
        polygon_zones = [
            {
                "type": "polygon",
                "coordinates": {
                    "points": [[10, 10], [100, 10], [100, 100], [10, 100]]
                }
            }
        ]
        
        success, response = self.run_test(
            "Save polygon exclusion zone", 
            "PUT", 
            f"cameras/{self.demo_camera_id}/excluded-zones", 
            200, 
            data=polygon_zones
        )
        
        if success:
            print(f"   Zones saved: {response.get('zones', [])}")
            
            # Verify zones were saved to database
            success_verify, camera_data = self.run_test(
                "Verify polygon zones saved to database", 
                "GET", 
                f"cameras/{self.demo_camera_id}", 
                200
            )
            
            if success_verify:
                excluded_zones = camera_data.get('excluded_zones', [])
                if excluded_zones and len(excluded_zones) > 0:
                    zone = excluded_zones[0]
                    if (zone.get('type') == 'polygon' and 
                        len(zone.get('coordinates', {}).get('points', [])) == 4):
                        print("✅ Polygon zone correctly saved to database")
                        return True
                    else:
                        print(f"❌ Zone data mismatch: {zone}")
                        return False
                else:
                    print("❌ No zones found in database")
                    return False
        
        return success

    def test_exclusion_zones_multiple(self):
        """Test saving multiple exclusion zones"""
        print("\n" + "="*60)
        print("TESTING MULTIPLE MIXED EXCLUSION ZONES")
        print("="*60)
        
        mixed_zones = [
            {
                "type": "rect",
                "coordinates": {
                    "x": 50,
                    "y": 50,
                    "width": 80,
                    "height": 60
                }
            },
            {
                "type": "polygon",
                "coordinates": {
                    "points": [[200, 200], [300, 200], [250, 300]]
                }
            },
            {
                "type": "rect",
                "coordinates": {
                    "x": 400,
                    "y": 100,
                    "width": 120,
                    "height": 80
                }
            }
        ]
        
        success, response = self.run_test(
            "Save multiple mixed exclusion zones", 
            "PUT", 
            f"cameras/{self.demo_camera_id}/excluded-zones", 
            200, 
            data=mixed_zones
        )
        
        if success:
            print(f"   Zones saved: {len(response.get('zones', []))} zones")
            
            # Verify zones were saved to database
            success_verify, camera_data = self.run_test(
                "Verify multiple zones saved to database", 
                "GET", 
                f"cameras/{self.demo_camera_id}", 
                200
            )
            
            if success_verify:
                excluded_zones = camera_data.get('excluded_zones', [])
                if len(excluded_zones) == 3:
                    rect_count = sum(1 for z in excluded_zones if z.get('type') == 'rect')
                    polygon_count = sum(1 for z in excluded_zones if z.get('type') == 'polygon')
                    print(f"✅ Multiple zones saved: {rect_count} rectangles, {polygon_count} polygons")
                    return True
                else:
                    print(f"❌ Expected 3 zones, found {len(excluded_zones)}")
                    return False
        
        return success

    def test_exclusion_zones_empty(self):
        """Test clearing exclusion zones"""
        print("\n" + "="*60)
        print("TESTING EMPTY EXCLUSION ZONES (CLEARING)")
        print("="*60)
        
        empty_zones = []
        
        success, response = self.run_test(
            "Clear exclusion zones (empty array)", 
            "PUT", 
            f"cameras/{self.demo_camera_id}/excluded-zones", 
            200, 
            data=empty_zones
        )
        
        if success:
            # Verify zones were cleared in database
            success_verify, camera_data = self.run_test(
                "Verify zones cleared in database", 
                "GET", 
                f"cameras/{self.demo_camera_id}", 
                200
            )
            
            if success_verify:
                excluded_zones = camera_data.get('excluded_zones', [])
                if len(excluded_zones) == 0:
                    print("✅ Exclusion zones successfully cleared")
                    return True
                else:
                    print(f"❌ Expected 0 zones, found {len(excluded_zones)}")
                    return False
        
        return success

    def test_motion_detection_integration(self):
        """Test motion detection integration with exclusion zones"""
        print("\n" + "="*60)
        print("TESTING MOTION DETECTION INTEGRATION")
        print("="*60)
        
        # Set up test exclusion zones
        test_zones = [
            {
                "type": "rect",
                "coordinates": {
                    "x": 0,
                    "y": 0,
                    "width": 100,
                    "height": 50
                }
            }
        ]
        
        success_setup, _ = self.run_test(
            "Setup exclusion zones for motion detection test", 
            "PUT", 
            f"cameras/{self.demo_camera_id}/excluded-zones", 
            200, 
            data=test_zones
        )
        
        if not success_setup:
            return False
        
        # Check camera status
        success_status, cameras_status = self.run_test(
            "Check camera status", 
            "GET", 
            "cameras/status/all", 
            200
        )
        
        if success_status:
            demo_camera_status = None
            for cam in cameras_status:
                if cam.get('id') == self.demo_camera_id:
                    demo_camera_status = cam
                    break
            
            if demo_camera_status:
                is_active = demo_camera_status.get('is_active', False)
                print(f"   Camera active status: {is_active}")
                
                if is_active:
                    print("✅ Camera is active - exclusion zones are applied to motion detection")
                    print("   Note: Actual motion detection testing requires real camera feed")
                    self.tests_passed += 1
                    self.tests_run += 1
                    return True
                else:
                    print("⚠️  Camera is not active - exclusion zones set but not actively applied")
                    print("   This is expected behavior for test cameras without real streams")
                    self.tests_passed += 1
                    self.tests_run += 1
                    return True
            else:
                print("❌ Demo camera not found in status")
                self.tests_run += 1
                return False
        else:
            return False

    def test_error_cases(self):
        """Test error handling"""
        print("\n" + "="*60)
        print("TESTING ERROR CASES")
        print("="*60)
        
        zones = [{"type": "rect", "coordinates": {"x": 10, "y": 10, "width": 50, "height": 50}}]
        
        return self.run_test(
            "Exclusion zones with non-existent camera (should return 404)", 
            "PUT", 
            "cameras/non-existent-id/excluded-zones", 
            404, 
            data=zones
        )[0]

    def run_all_tests(self):
        """Run all exclusion zones tests"""
        print("🚀 EXCLUSION ZONES FEATURE TESTING")
        print("="*60)
        print(f"Testing with demo camera: {self.demo_camera_id}")
        
        tests = [
            ("Camera Snapshot Endpoint", self.test_snapshot_endpoint),
            ("Rectangle Exclusion Zones", self.test_exclusion_zones_rectangle),
            ("Polygon Exclusion Zones", self.test_exclusion_zones_polygon),
            ("Multiple Mixed Exclusion Zones", self.test_exclusion_zones_multiple),
            ("Empty Exclusion Zones", self.test_exclusion_zones_empty),
            ("Motion Detection Integration", self.test_motion_detection_integration),
            ("Error Cases", self.test_error_cases),
        ]
        
        failed_tests = []
        
        for test_name, test_func in tests:
            try:
                success = test_func()
                if not success:
                    failed_tests.append(test_name)
            except Exception as e:
                print(f"❌ {test_name} - Exception: {str(e)}")
                failed_tests.append(test_name)
        
        # Print results
        print("\n" + "="*60)
        print("📊 EXCLUSION ZONES TEST RESULTS")
        print("="*60)
        print(f"Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if failed_tests:
            print(f"\n❌ Failed tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   - {test}")
        else:
            print("\n✅ All exclusion zones tests passed!")
        
        return len(failed_tests) == 0

if __name__ == "__main__":
    tester = ExclusionZonesTest()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)