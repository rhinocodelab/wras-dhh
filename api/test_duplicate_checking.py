#!/usr/bin/env python3
"""
Test script to verify duplicate checking functionality
"""

import requests
import json
import time

# API base URL
API_BASE_URL = "http://localhost:5001"

def test_duplicate_checking():
    """Test duplicate checking for audio files and templates"""
    
    print("🧪 Testing Duplicate Checking Functionality")
    print("=" * 50)
    
    # Test data
    test_text = "Welcome to Mumbai Central Station. Please mind the gap between the train and the platform."
    
    # Test 1: Check duplicate before creating
    print("\n1. Testing duplicate check endpoint...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/audio-files/check-duplicate",
            json={"english_text": test_text},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Duplicate check successful")
            print(f"   Has duplicates: {result['has_duplicates']}")
            if result['duplicates']:
                print(f"   Duplicates found: {json.dumps(result['duplicates'], indent=2)}")
        else:
            print(f"❌ Duplicate check failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing duplicate check: {e}")
    
    # Test 2: Create first audio file
    print("\n2. Creating first audio file...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/audio-files",
            json={"english_text": test_text},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ First audio file created successfully (ID: {result['id']})")
            first_file_id = result['id']
        else:
            print(f"❌ Failed to create first audio file: {response.status_code}")
            print(f"   Response: {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Error creating first audio file: {e}")
        return
    
    # Test 3: Try to create duplicate audio file
    print("\n3. Attempting to create duplicate audio file...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/audio-files",
            json={"english_text": test_text},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 409:
            result = response.json()
            print(f"✅ Duplicate detection working correctly")
            print(f"   Error: {result['detail']}")
        else:
            print(f"❌ Duplicate detection failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing duplicate creation: {e}")
    
    # Test 4: Create template with same text
    print("\n4. Creating template with same text...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/templates",
            json={
                "category": "Test Category",
                "title": "Test Template",
                "english_text": test_text
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Template created successfully (ID: {result['id']})")
            template_id = result['id']
        else:
            print(f"❌ Failed to create template: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error creating template: {e}")
    
    # Test 5: Try to create duplicate template
    print("\n5. Attempting to create duplicate template...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/templates",
            json={
                "category": "Test Category 2",
                "title": "Test Template 2",
                "english_text": test_text
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 409:
            result = response.json()
            print(f"✅ Template duplicate detection working correctly")
            print(f"   Error: {result['detail']}")
        else:
            print(f"❌ Template duplicate detection failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing template duplicate creation: {e}")
    
    # Test 6: Check duplicate summary
    print("\n6. Testing duplicate summary...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/audio-files/check-duplicate",
            json={"english_text": test_text},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Duplicate summary check successful")
            print(f"   Has duplicates: {result['has_duplicates']}")
            if result['duplicates']:
                print(f"   Duplicates found:")
                for duplicate_type, duplicate_info in result['duplicates'].items():
                    print(f"     - {duplicate_type}: {duplicate_info}")
        else:
            print(f"❌ Duplicate summary check failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing duplicate summary: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Duplicate checking test completed!")

if __name__ == "__main__":
    test_duplicate_checking() 