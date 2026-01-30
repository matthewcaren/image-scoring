import json
import sys

def find_correct_choice(trial):
    """Find the choice marked as correct in a trial."""
    for choice in trial['choices']:
        if choice.get('correct_answer', False):
            return choice
    return None

def states_match(state1, state2):
    """Check if two states are identical."""
    return (state1['irregularity'] == state2['irregularity'] and
            state1['aspect_ratio'] == state2['aspect_ratio'] and
            state1['color'] == state2['color'])

def find_matching_trials(file1_data, file2_data):
    """Find trials with matching correct answer states between two files."""
    matches = []
    
    for i, trial1 in enumerate(file1_data):
        correct1 = find_correct_choice(trial1)
        if not correct1:
            continue
            
        for j, trial2 in enumerate(file2_data):
            correct2 = find_correct_choice(trial2)
            if not correct2:
                continue
            
            # Check if start and end states match
            if (states_match(correct1['start_state'], correct2['start_state']) and
                states_match(correct1['end_state'], correct2['end_state'])):
                matches.append({
                    'file1_trial_index': i,
                    'file2_trial_index': j,
                    'audio1': trial1['audio'],
                    'audio2': trial2['audio'],
                    'start_state': correct1['start_state'],
                    'end_state': correct1['end_state']
                })
                break  # Found a match for this trial1, move to next
    
    return matches

def create_condition_data(file_pairs):
    """Create matched trial data for a condition from two file pairs."""
    all_matches = []
    
    for pair in file_pairs:
        file1_path = pair[0]
        file2_path = pair[1]
        
        print(f"Processing pair: {file1_path} and {file2_path}")
        
        try:
            with open(file1_path, 'r', encoding='utf-8') as f:
                content1 = f.read().strip()
                
            with open(file2_path, 'r', encoding='utf-8') as f:
                content2 = f.read().strip()
            
            # Handle JavaScript format: const trialsData = [...]
            if content1.startswith('const trialsData'):
                # Find the start of the array
                start_idx = content1.find('[')
                end_idx = content1.rfind(']')
                if start_idx != -1 and end_idx != -1:
                    content1 = content1[start_idx:end_idx+1]
            
            if content2.startswith('const trialsData'):
                start_idx = content2.find('[')
                end_idx = content2.rfind(']')
                if start_idx != -1 and end_idx != -1:
                    content2 = content2[start_idx:end_idx+1]
            
            # Parse JSON
            file1_data = json.loads(content1)
            file2_data = json.loads(content2)
            
            matches = find_matching_trials(file1_data, file2_data)
            
            # Add metadata about which files these came from
            for match in matches:
                match['file1_name'] = file1_path
                match['file2_name'] = file2_path
            
            all_matches.extend(matches)
            print(f"  Found {len(matches)} matches")
            
        except Exception as e:
            print(f"  Error processing pair: {e}")
            import traceback
            traceback.print_exc()
    
    return all_matches

def main():
    # Define the 4 conditions
    conditions = [
        {
            'name': 'condition_1',
            'pairs': [
                ('A-musical.json', 'A-referential.json'),
                ('B-musical.json', 'B-referential.json')
            ]
        },
        {
            'name': 'condition_2',
            'pairs': [
                ('C-musical.json', 'C-referential.json'),
                ('D-musical.json', 'D-referential.json')
            ]
        },
        {
            'name': 'condition_3',
            'pairs': [
                ('E-musical.json', 'E-referential.json'),
                ('F-musical.json', 'F-referential.json')
            ]
        },
        {
            'name': 'condition_4',
            'pairs': [
                ('G-musical.json', 'G-referential.json'),
                ('H-musical.json', 'H-referential.json')
            ]
        }
    ]
    
    # Process each condition
    for condition in conditions:
        print(f"\n{'='*60}")
        print(f"Processing {condition['name']}")
        print(f"{'='*60}")
        
        matches = create_condition_data(condition['pairs'])
        
        # Save as JavaScript file
        output_filename = f"{condition['name']}_trials.json"
        with open(output_filename, 'w') as f:
            f.write('const trialsData = ')
            json.dump(matches, f, indent=2)
            f.write(';')
        
        print(f"\nSaved {len(matches)} trials to {output_filename}")
        
        if len(matches) != 18:
            print(f"WARNING: Expected 18 trials but got {len(matches)}")

if __name__ == '__main__':
    main()